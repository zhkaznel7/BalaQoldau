import OpenAI from 'openai';
import {z} from 'zod';
import {conversationContext} from './conversation.ts';
import {providerCues} from './intent.ts';

const replySchema = z.strictObject({
  intent: conversationContext,
  style: z.enum(['direct', 'warm']),
  askActivity: z.boolean(),
});
const {type, properties, required, additionalProperties} = z.toJSONSchema(replySchema);
const timeoutMs = 4000;
type Cues = ReturnType<typeof providerCues>;
export type OpenAIInterpreter = (cues: Cues, signal: AbortSignal) => Promise<z.infer<typeof replySchema>>;

export function createOpenAIInterpreter(apiKey: string, model: string, fetcher?: typeof fetch): OpenAIInterpreter {
  const client = new OpenAI({
    apiKey, baseURL: 'https://api.openai.com/v1', timeout: timeoutMs, maxRetries: 0, logLevel: 'off',
    fetch: (input, init) => (fetcher ?? fetch)(input, {...init, redirect: 'error'}),
  });
  return async (cues, signal) => {
    const completion = await client.chat.completions.create({
      model, store: false, max_completion_tokens: 128,
      messages: [
        {role: 'system', content: 'Interpret the ordered catalog search cues. Choose only values present for each field. Leave ambiguous and excluded values null. Use warm style for clarifications. Set askActivity when a club is requested without an activity type.'},
        {role: 'user', content: JSON.stringify(cues)},
      ],
      response_format: {type: 'json_schema', json_schema: {
        name: 'catalog_search_turn', strict: true, schema: {type, properties, required, additionalProperties},
      }},
    }, {signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])});
    const choice = completion.choices[0];
    if (choice?.finish_reason !== 'stop' || choice.message.refusal || !choice.message.content) {
      throw new Error('Incomplete provider response');
    }
    const reply = replySchema.parse(JSON.parse(choice.message.content));
    for (const [field, value] of Object.entries(reply.intent)) {
      if (value !== null && !cues.some(cue => cue.field === field && cue.value === value)) {
        throw new Error('Unsupported provider selection');
      }
    }
    return reply;
  };
}
