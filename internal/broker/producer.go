package broker

import (
	"context"
	"fmt"

	"github.com/twmb/franz-go/pkg/kgo"
	"kafkalet/internal/profile"
)

// ProduceHeader is a single Kafka record header.
type ProduceHeader struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// ProduceRequest carries the fields needed to produce a single message.
type ProduceRequest struct {
	Topic     string          `json:"topic"`
	Partition int32           `json:"partition"` // -1 = let Kafka choose
	Key       string          `json:"key"`
	Value     string          `json:"value"`
	Headers   []ProduceHeader `json:"headers"`
}

// ProduceMessage produces a single message synchronously and waits for acks.
func ProduceMessage(ctx context.Context, b profile.Broker, password string, req ProduceRequest) error {
	var extra []kgo.Opt
	if req.Partition >= 0 {
		extra = append(extra, kgo.RecordPartitioner(kgo.ManualPartitioner()))
	}

	client, err := NewClient(b, password, extra...)
	if err != nil {
		return fmt.Errorf("create client: %w", err)
	}
	defer client.Close()

	record := &kgo.Record{
		Topic: req.Topic,
		Key:   []byte(req.Key),
		Value: []byte(req.Value),
	}
	if req.Partition >= 0 {
		record.Partition = req.Partition
	}
	for _, h := range req.Headers {
		record.Headers = append(record.Headers, kgo.RecordHeader{Key: h.Key, Value: []byte(h.Value)})
	}

	results := client.ProduceSync(ctx, record)
	if err := results.FirstErr(); err != nil {
		return fmt.Errorf("produce: %w", err)
	}
	return nil
}
