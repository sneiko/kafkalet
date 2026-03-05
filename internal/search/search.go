package search

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kgo"
	"kafkalet/internal/broker"
	"kafkalet/internal/profile"
	"kafkalet/internal/schema"
)

const progressInterval = 1000

// EmitFunc sends an event to the frontend (goroutine-safe).
type EmitFunc func(eventName string, data any)

// SearchSession scans a topic for messages matching a pattern.
type SearchSession struct {
	id     string
	client *kgo.Client
	cancel context.CancelFunc
}

func (s *SearchSession) ID() string { return s.id }
func (s *SearchSession) Stop()      { s.cancel() }

// matcher checks whether a string matches the search pattern.
type matcher func(s string) bool

func buildMatcher(pattern string, useRegex bool) (matcher, error) {
	if pattern == "" {
		return nil, nil
	}
	if useRegex {
		re, err := regexp.Compile(pattern)
		if err != nil {
			return nil, fmt.Errorf("invalid regex %q: %w", pattern, err)
		}
		return re.MatchString, nil
	}
	lower := strings.ToLower(pattern)
	return func(s string) bool {
		return strings.Contains(strings.ToLower(s), lower)
	}, nil
}

// newSearchSession creates and starts a search session.
func newSearchSession(
	appCtx context.Context,
	sessionID string,
	b profile.Broker,
	password string,
	req SearchRequest,
	reg *schema.Registry,
	emit EmitFunc,
) (*SearchSession, error) {
	// Build matchers
	keyMatcher, err := buildMatcher(req.KeyPattern, req.UseRegex)
	if err != nil {
		return nil, err
	}
	valueMatcher, err := buildMatcher(req.ValuePattern, req.UseRegex)
	if err != nil {
		return nil, err
	}

	// Resolve start/end offsets via kadm using a temporary client
	tmpClient, err := broker.NewClient(b, password)
	if err != nil {
		return nil, fmt.Errorf("search %s: create admin client: %w", sessionID, err)
	}
	adm := kadm.NewClient(tmpClient)

	// Determine which partitions to scan
	var partitions []int32
	if len(req.Partitions) > 0 {
		partitions = req.Partitions
	} else {
		details, listErr := adm.ListTopics(appCtx, req.Topic)
		if listErr != nil {
			tmpClient.Close()
			return nil, fmt.Errorf("search %s: list topics: %w", sessionID, listErr)
		}
		td, ok := details[req.Topic]
		if !ok {
			tmpClient.Close()
			return nil, fmt.Errorf("search %s: topic %q not found", sessionID, req.Topic)
		}
		for _, p := range td.Partitions {
			partitions = append(partitions, p.Partition)
		}
	}

	// Resolve start offsets
	var startOffsets kadm.ListedOffsets
	if req.TimestampFrom != nil {
		startOffsets, err = adm.ListOffsetsAfterMilli(appCtx, *req.TimestampFrom, req.Topic)
	} else {
		startOffsets, err = adm.ListStartOffsets(appCtx, req.Topic)
	}
	if err != nil {
		tmpClient.Close()
		return nil, fmt.Errorf("search %s: list start offsets: %w", sessionID, err)
	}

	// Resolve end offsets
	var endOffsets kadm.ListedOffsets
	if req.TimestampTo != nil {
		endOffsets, err = adm.ListOffsetsAfterMilli(appCtx, *req.TimestampTo, req.Topic)
	} else {
		endOffsets, err = adm.ListEndOffsets(appCtx, req.Topic)
	}
	if err != nil {
		tmpClient.Close()
		return nil, fmt.Errorf("search %s: list end offsets: %w", sessionID, err)
	}
	tmpClient.Close()

	// Build partition offset maps and estimate total
	partitionStarts := make(map[int32]int64)
	partitionEnds := make(map[int32]int64)
	var totalEst int64

	partSet := make(map[int32]bool, len(partitions))
	for _, p := range partitions {
		partSet[p] = true
	}

	startOffsets.Each(func(l kadm.ListedOffset) {
		if l.Topic != req.Topic || !partSet[l.Partition] {
			return
		}
		partitionStarts[l.Partition] = l.Offset
	})
	endOffsets.Each(func(l kadm.ListedOffset) {
		if l.Topic != req.Topic || !partSet[l.Partition] {
			return
		}
		partitionEnds[l.Partition] = l.Offset
		start := partitionStarts[l.Partition]
		if l.Offset > start {
			totalEst += l.Offset - start
		}
	})

	// Build consume partitions for franz-go
	consumePartitions := map[string]map[int32]kgo.Offset{req.Topic: {}}
	for _, p := range partitions {
		start, ok := partitionStarts[p]
		if !ok {
			continue
		}
		consumePartitions[req.Topic][p] = kgo.NewOffset().At(start)
	}

	if len(consumePartitions[req.Topic]) == 0 {
		return nil, fmt.Errorf("search %s: no partitions to scan", sessionID)
	}

	// Create the consumer client
	client, err := broker.NewClient(b, password, kgo.ConsumePartitions(consumePartitions))
	if err != nil {
		return nil, fmt.Errorf("search %s: create client: %w", sessionID, err)
	}

	sessCtx, cancel := context.WithCancel(appCtx)
	s := &SearchSession{
		id:     sessionID,
		client: client,
		cancel: cancel,
	}

	decode := buildDecode(reg)

	go s.scanLoop(sessCtx, req, keyMatcher, valueMatcher, decode, partitionEnds, totalEst, emit)
	return s, nil
}

func (s *SearchSession) scanLoop(
	ctx context.Context,
	req SearchRequest,
	keyMatch, valueMatch matcher,
	decode func([]byte) string,
	partitionEnds map[int32]int64,
	totalEst int64,
	emit EmitFunc,
) {
	defer s.client.Close()

	var scanned int64
	var matched int

	donePartitions := make(map[int32]bool)
	matchPrefix := "search:match:" + s.id
	progressPrefix := "search:progress:" + s.id

	emitProgress := func(done bool, errStr string) {
		emit(progressPrefix, SearchProgress{
			Scanned:  scanned,
			TotalEst: totalEst,
			Matched:  matched,
			Done:     done,
			Error:    errStr,
		})
	}

	for {
		if ctx.Err() != nil {
			emitProgress(true, "")
			return
		}

		fetches := s.client.PollFetches(ctx)
		if ctx.Err() != nil {
			emitProgress(true, "")
			return
		}

		fetches.EachError(func(t string, p int32, err error) {
			slog.Warn("search fetch error", "session", s.id, "topic", t, "partition", p, "err", err)
		})

		fetches.EachRecord(func(r *kgo.Record) {
			// Check if this partition is already done
			if donePartitions[r.Partition] {
				return
			}

			// Check if we've passed the end offset
			endOff, hasEnd := partitionEnds[r.Partition]
			if hasEnd && r.Offset >= endOff {
				donePartitions[r.Partition] = true
				return
			}

			scanned++

			// Check scan limit
			if req.MaxScan > 0 && scanned > req.MaxScan {
				return
			}

			// Match on raw bytes first (before expensive decode)
			rawKey := safeString(r.Key)
			rawValue := safeString(r.Value)

			keyMatched := keyMatch == nil || keyMatch(rawKey)
			valueMatched := valueMatch == nil || valueMatch(rawValue)

			if keyMatched && valueMatched {
				// Decode value for the match result
				displayValue := decode(r.Value)

				// If we decoded and have a value matcher, re-check against decoded value
				if valueMatch != nil && displayValue != rawValue {
					valueMatched = valueMatch(displayValue)
				}

				if keyMatched && valueMatched {
					matched++
					emit(matchPrefix, SearchMatch{
						Topic:     r.Topic,
						Partition: r.Partition,
						Offset:    r.Offset,
						Key:       rawKey,
						Value:     displayValue,
						Timestamp: r.Timestamp,
						Headers:   convertHeaders(r.Headers),
					})
				}
			}

			// Emit progress periodically
			if scanned%progressInterval == 0 {
				emitProgress(false, "")
			}
		})

		// Check completion conditions
		if req.MaxResults > 0 && matched >= req.MaxResults {
			emitProgress(true, "")
			return
		}
		if req.MaxScan > 0 && scanned >= req.MaxScan {
			emitProgress(true, "")
			return
		}

		// Check if all partitions are done
		allDone := true
		for _, p := range partitionEndsKeys(partitionEnds) {
			if !donePartitions[p] {
				allDone = false
				break
			}
		}
		if allDone {
			emitProgress(true, "")
			return
		}
	}
}

func partitionEndsKeys(m map[int32]int64) []int32 {
	keys := make([]int32, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// safeString converts a byte slice to string. Uses base64 if the bytes
// are not valid UTF-8.
func safeString(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	if utf8.Valid(b) {
		return string(b)
	}
	return base64.StdEncoding.EncodeToString(b)
}

// convertHeaders converts franz-go record headers to our Header type.
func convertHeaders(headers []kgo.RecordHeader) []Header {
	result := make([]Header, 0, len(headers))
	for _, h := range headers {
		result = append(result, Header{
			Key:   h.Key,
			Value: safeString(h.Value),
		})
	}
	return result
}

// buildDecode returns a value-decode function backed by Schema Registry (if reg != nil).
func buildDecode(reg *schema.Registry) func([]byte) string {
	if reg == nil {
		return safeString
	}
	return func(raw []byte) string {
		decoded, ok, err := schema.TryDecodeAvro(reg, raw)
		if ok {
			if err != nil {
				return fmt.Sprintf("[avro decode error: %v]", err)
			}
			return decoded
		}
		return safeString(raw)
	}
}
