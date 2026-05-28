import 'package:google_generative_ai/google_generative_ai.dart';

import '../models/message.dart';

class GeminiService {
  late final GenerativeModel _model;

  GeminiService({required String apiKey}) {
    _model = GenerativeModel(
      model: 'gemini-2.5-flash',
      apiKey: apiKey,
      generationConfig: GenerationConfig(
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      ),
    );
  }

  Future<String> rankRestaurants({
    required String mood,
    required String restaurantList,
  }) async {
    final prompt =
        '''You are "MoodMunch", a party planning expert for the MoodMunch app. The user's party theme is: "$mood"

Here are nearby restaurants and caterers found:
$restaurantList

Pick the TOP 5 venues that BEST match this party theme. Mix restaurants and caterers when helpful. For each, respond in this EXACT JSON format (no markdown, no code fences, just raw JSON array):
[
  {
    "name": "Venue Name",
    "reason": "One sentence why this matches the party theme",
    "cuisine": "cuisine type",
    "distance": "distance as shown",
    "type": "restaurant or caterer",
    "priceRange": "₹500-800/person",
    "menuHighlight": "Butter Chicken, Biryani, Naan"
  }
]

If fewer than 5 match well, return fewer. Only return the JSON array, nothing else.''';

    return _generateText(prompt);
  }

  Future<String> chatWithContext(
    List<Message> history,
    String systemPrompt,
  ) async {
    final relevantHistory = history.length > 20
        ? history.sublist(history.length - 20)
        : history;
    final transcript = relevantHistory
        .map(
          (message) =>
              '${message.role == MessageRole.user ? 'User' : 'Assistant'}: ${message.content}',
        )
        .join('\\n');

    final prompt =
        '''$systemPrompt

Conversation context:
$transcript

Respond to the latest user need while following the instructions above exactly.
If structured output was requested, return only that structured output.
Do not add markdown code fences unless explicitly requested.''';

    return _generateText(prompt);
  }

  Future<String> _generateText(String prompt) {
    return _withRetry(() async {
      final response = await _model.generateContent([Content.text(prompt)]);
      return response.text ?? '';
    });
  }

  Future<String> _withRetry(
    Future<String> Function() fn, {
    int maxRetries = 3,
  }) async {
    for (int i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (e) {
        final errStr = e.toString().toLowerCase();
        if ((errStr.contains('quota') ||
                errStr.contains('429') ||
                errStr.contains('rate')) &&
            i < maxRetries - 1) {
          await Future.delayed(Duration(seconds: 40 + (i * 10)));
          continue;
        }
        rethrow;
      }
    }
    throw Exception('Failed after $maxRetries retries');
  }
}
