package plugin

// Plugin defines a custom message decoder.
// The Script is a JavaScript function body that receives (value, key, headers)
// and returns a decoded string representation. Executed in the frontend JS engine.
// TopicPattern is a regular expression matched against the topic name.
type Plugin struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	TopicPattern string `json:"topicPattern"` // regexp matched against topic name
	Script       string `json:"script"`       // JS function body
}
