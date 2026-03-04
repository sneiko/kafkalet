package broker

import (
	"context"
	"fmt"
	"time"

	"github.com/twmb/franz-go/pkg/kadm"
	"kafkalet/internal/profile"
)

// TopicRate is the approximate message throughput for a single topic.
type TopicRate struct {
	Topic          string  `json:"topic"`
	MessagesPerSec float64 `json:"messagesPerSec"`
	TotalMessages  int64   `json:"totalMessages"`
}

// RateSnapshot is emitted by StartRateWatcher on each tick.
type RateSnapshot struct {
	Topics []TopicRate `json:"topics"`
}

// StartRateWatcher starts a background goroutine that polls LEO for all topics
// every intervalSec seconds and calls emit with the computed delta rates.
// Returns a cancel function that stops the watcher.
func StartRateWatcher(ctx context.Context, b profile.Broker, password string, intervalSec int, emit func(RateSnapshot)) (context.CancelFunc, error) {
	client, err := NewClient(b, password)
	if err != nil {
		return nil, fmt.Errorf("create client: %w", err)
	}

	adm := kadm.NewClient(client)

	// Take baseline snapshot before starting the ticker.
	baseline, err := adm.ListEndOffsets(ctx)
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("list end offsets (baseline): %w", err)
	}
	baselineTime := time.Now()
	prevOffsets := leoTotals(baseline)

	watchCtx, cancel := context.WithCancel(ctx)

	go func() {
		defer client.Close()

		dur := time.Duration(intervalSec) * time.Second
		ticker := time.NewTicker(dur)
		defer ticker.Stop()

		for {
			select {
			case <-watchCtx.Done():
				return
			case t := <-ticker.C:
				current, listErr := adm.ListEndOffsets(watchCtx)
				if listErr != nil {
					continue
				}
				elapsed := t.Sub(baselineTime).Seconds()
				currentTotals := leoTotals(current)

				snap := RateSnapshot{Topics: make([]TopicRate, 0, len(currentTotals))}
				for topic, total := range currentTotals {
					prev := prevOffsets[topic]
					delta := max(total-prev, 0)
					rate := 0.0
					if elapsed > 0 {
						rate = float64(delta) / elapsed
					}
					snap.Topics = append(snap.Topics, TopicRate{
						Topic:          topic,
						MessagesPerSec: rate,
						TotalMessages:  total,
					})
				}
				emit(snap)

				prevOffsets = currentTotals
				baselineTime = t
			}
		}
	}()

	return cancel, nil
}

// leoTotals sums end offsets across all partitions per topic.
func leoTotals(offsets kadm.ListedOffsets) map[string]int64 {
	totals := make(map[string]int64)
	offsets.Each(func(o kadm.ListedOffset) {
		if o.Err == nil && o.Offset >= 0 {
			totals[o.Topic] += o.Offset
		}
	})
	return totals
}
