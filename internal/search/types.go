package search

import "time"

// SearchRequest describes what and how to search in a Kafka topic.
type SearchRequest struct {
	Topic         string  `json:"topic"`
	KeyPattern    string  `json:"keyPattern"`
	ValuePattern  string  `json:"valuePattern"`
	Partitions    []int32 `json:"partitions"`    // empty = all
	TimestampFrom *int64  `json:"timestampFrom"` // unix ms, nil = earliest
	TimestampTo   *int64  `json:"timestampTo"`   // unix ms, nil = latest
	MaxResults    int     `json:"maxResults"`     // default 1000
	MaxScan       int64   `json:"maxScan"`        // default 1_000_000
	UseRegex      bool    `json:"useRegex"`
}

// SearchProgress is emitted periodically during a search scan.
type SearchProgress struct {
	Scanned  int64  `json:"scanned"`
	TotalEst int64  `json:"totalEst"`
	Matched  int    `json:"matched"`
	Done     bool   `json:"done"`
	Error    string `json:"error,omitempty"`
}

// SearchMatch is emitted for each message that matches the search pattern.
type SearchMatch struct {
	Topic     string    `json:"topic"`
	Partition int32     `json:"partition"`
	Offset    int64     `json:"offset"`
	Key       string    `json:"key"`
	Value     string    `json:"value"`
	Timestamp time.Time `json:"timestamp"`
	Headers   []Header  `json:"headers"`
}

// Header is a single Kafka record header.
type Header struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}
