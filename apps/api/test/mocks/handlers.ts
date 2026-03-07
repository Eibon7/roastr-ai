import { http, HttpResponse } from 'msw';

const perspectiveHandlers = [
  http.post(
    'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze',
    () => {
      return HttpResponse.json({
        attributeScores: {
          TOXICITY: { summaryScore: { value: 0.15 } },
          IDENTITY_ATTACK: { summaryScore: { value: 0.05 } },
          THREAT: { summaryScore: { value: 0.02 } },
          INSULT: { summaryScore: { value: 0.1 } },
        },
      });
    },
  ),
];

const openaiHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              toxicity_level: 'low',
              has_identity_attack: false,
              has_threat: false,
              insults_count: 0,
              has_initial_insult_with_argument: false,
            }),
          },
        },
      ],
    });
  }),
];

const polarHandlers = [
  http.get('https://api.polar.sh/v1/subscriptions/:id', () => {
    return HttpResponse.json({
      id: 'sub_mock_123',
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  }),
];

export const handlers = [
  ...perspectiveHandlers,
  ...openaiHandlers,
  ...polarHandlers,
];
