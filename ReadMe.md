# TextProtobufParserJs

*TextProtobufParserJs* is a JavaScript parser of text format protobuf **without .proto definition**. 

Some protobuf API (e.g. C++ `ShortDebugString()`) will serialize message into human-readable strings, i.e. *text proto*. But it's not readable enough. 
Official protobuf API can parse text proto only with message definition. But *TextProtobufParserJs* can parse text proto into JavaScript Object independently.

# Usage

```javascript
const TextProtobufParser = require('text_protobuf_parser')

// parse
let parser = new TextProtobufParser.TextProtobufParser()
let msg = parser.parse('field_1: 1 field_2: true') 
// parser.parseInto('k: v', msg); If parse failed, the partial parsed result will be stored in msg

// to JSON
let msg_json = JSON.stringify(msg, TextProtobufParser.JsonStringifyReplacer)
// {"field_1":1,"field_2":true}
```

Parse result is an `Object` value that contains all message fields. The object's properties' type are:

- `Number`, `BigInt`.
- `true`, `false`.
- `TextProtobufParser.EnumValue` if value is enum. **Note:** text proto could not distinguish whether a value is true/false/nan or enum with these name.
- `String` if field is string and can be parsed into utf-8 string.
- `Uint8Array` if string but not utf-8, i.e. the original protobuf field is `bytes`.
- `Array`  if field is `repeated`
- Nested `Object` if field is `message`

# Application

`demo.html` use *TextProtobufParserJs* to convert text proto to JSON and pretty.

`TextProtobufPretty` is a **uTools plugin** that do the similar job, but can redirect the JSON result to other professional JSON plugins.
