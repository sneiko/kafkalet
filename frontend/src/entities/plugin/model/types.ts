export interface Plugin {
  id: string
  name: string
  topicPattern: string // regexp matched against topic name
  script: string // JS function body: (value, key, headers) => string
}
