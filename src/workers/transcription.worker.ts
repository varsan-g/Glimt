import { TransformersJSTranscriptionWorkerHandler } from '@browser-ai/transformers-js'

const handler = new TransformersJSTranscriptionWorkerHandler()
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg)
