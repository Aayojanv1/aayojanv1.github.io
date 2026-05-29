import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../data/menu_data.dart';
import '../models/caterer.dart';
import '../models/catering_order.dart';
import '../models/message.dart';
import '../models/party_menu.dart';
import '../services/caterer_db.dart';
import '../services/gemini_service.dart';
import '../services/places_service.dart';
import '../widgets/caterer_match_card.dart';
import '../widgets/menu_card.dart';
import '../widgets/price_card.dart';

enum ChatState {
  greeting,
  askPartyType,
  showMenu,
  customize,
  showPrice,
  findCaterer,
  showCaterers,
}

const Map<String, String> _knownAreas = {
  '700156': 'Action Area I, Newtown',
  '700157': 'Action Area II, Newtown',
  '700160': 'Eco Park, Sector IV',
  '700135': 'Rajarhat Main Road',
};

const Map<String, _KnownCoordinate> _knownCoordinates = {
  '700156': _KnownCoordinate(22.5778, 88.4794),
  '700157': _KnownCoordinate(22.5864, 88.4871),
  '700160': _KnownCoordinate(22.5937, 88.4672),
  '700135': _KnownCoordinate(22.6252, 88.4718),
};

const List<String> _guestQuickReplies = [
  '25 guests',
  '50 guests',
  '100 guests',
  '150 guests',
];
const List<String> _locationQuickReplies = [
  '700156',
  '700157',
  '700160',
  '700135',
];

class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.onBrowseThemesTap,
    required this.simulateMode,
    this.onOrderCreated,
    this.geminiService,
    this.placesService,
  });

  final VoidCallback onBrowseThemesTap;
  final bool simulateMode;
  final ValueChanged<CateringOrder>? onOrderCreated;
  final GeminiService? geminiService;
  final PlacesService? placesService;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _messages = <_ChatEntry>[];
  final _conversationHistory = <Message>[];
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  final _draft = _OrderDraft();
  final _catererDb = const CatererDb();

  ChatState _state = ChatState.greeting;
  bool _isLoading = false;
  bool _awaitingGuestCountChange = false;
  PartyMenu? _liveMenu;
  _LivePriceQuote? _livePriceQuote;

  PartyMenu? get _activeMenu {
    if (_draft.partyType == null) {
      return null;
    }
    if (widget.simulateMode) {
      return partyMenuForType(_draft.partyType!);
    }
    return _liveMenu;
  }

  @override
  void initState() {
    super.initState();
    _seedConversation();
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _seedConversation() {
    const greeting =
        '''Hey! 🎉 I'm **MoodMunch** — your planner for menus, pricing, and caterer matching.

We'll go from **party type → menu → price → caterers** in a few quick steps.''';
    const ask =
        "What kind of party are you planning? Pick one to start and I'll build the first menu card for you.";
    _messages
      ..add(const _ChatEntry.bot(text: greeting))
      ..add(
        _ChatEntry.bot(
          text: ask,
          quickReplies: widget.simulateMode ? kPartyTypes : null,
        ),
      );
    _recordAssistant(greeting);
    _recordAssistant(ask);
    _state = ChatState.askPartyType;
  }

  void _recordAssistant(String text) {
    _conversationHistory.add(
      Message(
        id: 'assistant-${DateTime.now().microsecondsSinceEpoch}',
        content: text,
        role: MessageRole.assistant,
      ),
    );
  }

  void _recordUser(String text) {
    _conversationHistory.add(
      Message(
        id: 'user-${DateTime.now().microsecondsSinceEpoch}',
        content: text,
        role: MessageRole.user,
      ),
    );
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage(String rawText) async {
    final text = rawText.trim();
    if (text.isEmpty || _isLoading) return;
    _inputController.clear();
    setState(() {
      _messages.add(_ChatEntry.user(text: text));
      _messages.add(const _ChatEntry.typing());
      _isLoading = true;
    });
    _recordUser(text);
    _scrollToBottom();
    try {
      _appendAssistantEntries(await _handleUserText(text));
    } catch (e) {
      _appendAssistantEntries([
        _ChatEntry.bot(
          text:
              'Something went wrong while planning your party. ${e.toString().replaceAll('Exception: ', '')}',
        ),
      ]);
    }
  }

  Future<void> _runCardAction(
    String label,
    Future<List<_ChatEntry>> Function() builder,
  ) async {
    if (_isLoading) return;
    setState(() {
      _messages.add(_ChatEntry.user(text: label));
      _messages.add(const _ChatEntry.typing());
      _isLoading = true;
    });
    _recordUser(label);
    _scrollToBottom();
    try {
      _appendAssistantEntries(await builder());
    } catch (e) {
      _appendAssistantEntries([
        _ChatEntry.bot(
          text:
              'I hit a snag while updating the plan. ${e.toString().replaceAll('Exception: ', '')}',
        ),
      ]);
    }
  }

  void _appendAssistantEntries(List<_ChatEntry> entries) {
    setState(() {
      _messages.removeWhere((entry) => entry.type == _ChatEntryType.typing);
      _messages.addAll(entries);
      _isLoading = false;
    });
    for (final entry in entries) {
      if (entry.type == _ChatEntryType.text &&
          entry.role == MessageRole.assistant &&
          entry.text != null) {
        _recordAssistant(entry.text!);
      }
    }
    _scrollToBottom();
  }

  Future<List<_ChatEntry>> _handleUserText(String text) async {
    final beforeGuests = _draft.guestCount;
    final beforePincode = _draft.pincode;
    final beforeItems = _draft.selectedMenuItems.length;
    _applyUserInput(text);

    if ((_state == ChatState.greeting || _state == ChatState.askPartyType) &&
        _draft.partyType != null) {
      return _buildMenuEntries();
    }
    if (_state == ChatState.askPartyType) {
      // In Gemini mode, respond conversationally
      if (!widget.simulateMode && widget.geminiService != null) {
        final response = await widget.geminiService!.chatWithContext(
          _conversationHistory,
          'You are MoodMunch, a party catering AI assistant. The user hasn\'t picked a party type yet. '
              'Available types: BBQ Bash, Bollywood Night, Kids Birthday, Cocktail Party, Italian Night, Asian Feast, Brunch Party, Game Night. '
              'Respond warmly to their message and guide them to pick a party type. Be brief (2 sentences max). '
              'If they seem unsure, ask what occasion they\'re celebrating.',
        );
        return [
          _ChatEntry.bot(text: response.trim().isEmpty
              ? 'I can plan **BBQ Bash**, **Bollywood Night**, **Kids Birthday**, **Cocktail Party**, **Italian Night**, **Asian Feast**, **Brunch Party**, or **Game Night**.'
              : response.trim()),
        ];
      }
      return [
        _ChatEntry.bot(
          text:
              'I can plan **BBQ Bash**, **Bollywood Night**, **Kids Birthday**, **Cocktail Party**, **Italian Night**, **Asian Feast**, **Brunch Party**, or **Game Night**.',
          quickReplies: widget.simulateMode ? kPartyTypes : null,
        ),
      ];
    }
    if (_state == ChatState.showMenu || _state == ChatState.customize) {
      _state = ChatState.customize;
      if (_looksLikeShowPrice(text) || _looksLikeConfirm(text)) {
        return _confirmMenu();
      }
      // Use Gemini for customization suggestions in live mode
      if (!widget.simulateMode && widget.geminiService != null) {
        final aiResponse = await _liveCustomizePrompt(
          text,
          guestChanged: beforeGuests != _draft.guestCount,
          locationChanged: beforePincode != _draft.pincode,
          menuChanged: beforeItems != _draft.selectedMenuItems.length,
        );
        return [
          _ChatEntry.bot(text: aiResponse),
          if (_activeMenu != null) _ChatEntry.menu(menu: _activeMenu!),
        ];
      }
      return [
        _ChatEntry.bot(
          text: _customizePrompt(
            guestChanged: beforeGuests != _draft.guestCount,
            locationChanged: beforePincode != _draft.pincode,
            menuChanged: beforeItems != _draft.selectedMenuItems.length,
          ),
          quickReplies: widget.simulateMode
              ? _customizationQuickReplies()
              : null,
        ),
      ];
    }

    if (_state == ChatState.showPrice) {
      if (_awaitingGuestCountChange && beforeGuests != _draft.guestCount) {
        _awaitingGuestCountChange = false;
        return _buildPriceEntries(preface: 'Done — I refreshed the estimate.');
      }
      if (_looksLikeChangeMenu(text)) return _returnToMenu();
      if (_looksLikeChangeGuestCount(text)) {
        _awaitingGuestCountChange = true;
        return [
          _ChatEntry.bot(
            text:
                "Sure — send me the new **guest count** and I'll recalculate.",
            quickReplies: widget.simulateMode ? _guestQuickReplies : null,
          ),
        ];
      }
      if (_looksLikeFindCaterer(text)) return _findCaterers();
      if (beforeGuests != _draft.guestCount && _draft.guestCount != null) {
        return _buildPriceEntries(preface: 'Updated with the new guest count.');
      }
      return const [
        _ChatEntry.bot(
          text:
              'Use the price card to **Find Caterer**, **Change Menu**, or **Change guest count**.',
        ),
      ];
    }
    if (_state == ChatState.showCaterers && _matchPartyType(text) != null) {
      _draft.reset();
      _awaitingGuestCountChange = false;
      _state = ChatState.askPartyType;
      _applyUserInput(text);
      return _buildMenuEntries();
    }
    return [
      _ChatEntry.bot(
        text:
            "If you want a fresh plan, send me another party type and I'll start again from the menu.",
        quickReplies: widget.simulateMode ? kPartyTypes : null,
      ),
    ];
  }

  Future<List<_ChatEntry>> _buildMenuEntries({String? preface}) async {
    if (_draft.partyType == null) {
      _state = ChatState.askPartyType;
      return [
        _ChatEntry.bot(
          text: "Pick a supported party type and I'll build the menu for it.",
          quickReplies: widget.simulateMode ? kPartyTypes : null,
        ),
      ];
    }

    if (!widget.simulateMode &&
        (_liveMenu == null || _liveMenu!.partyType != _draft.partyType)) {
      _liveMenu = await _generateLiveMenu(_draft.partyType!);
      _draft.selectedMenuItems
        ..clear()
        ..addAll(_defaultSelectedItems(_liveMenu!));
      _livePriceQuote = null;
    }

    final menu = _activeMenu;
    if (widget.simulateMode &&
        menu != null &&
        _draft.selectedMenuItems.isEmpty) {
      _draft.selectedMenuItems.addAll(_defaultSelectedItems(menu));
    }
    if (menu == null) {
      _state = ChatState.askPartyType;
      return [
        _ChatEntry.bot(
          text:
              'I could not build the menu yet. Please try the party type again so I can generate it.',
          quickReplies: widget.simulateMode ? kPartyTypes : null,
        ),
      ];
    }

    final intro = widget.simulateMode
        ? "Great choice! \u{1F38A} Here's my suggested menu for a **${menu.partyType}**:"
        : "MoodMunch curated this **${menu.partyType}** menu for your party. Tap items to refine it, then I'll recalculate the fair price and rank caterers.";
    _state = ChatState.showMenu;
    return [
      if (preface != null) _ChatEntry.bot(text: preface),
      _ChatEntry.bot(
        text: intro,
        quickReplies: widget.simulateMode
            ? const ['Looks good!', 'I want to customize']
            : null,
      ),
      _ChatEntry.menu(menu: menu),
      _ChatEntry.bot(
        text:
            "When you're happy with the spread, tell me your **guest count** and **pincode**, then tap **Confirm Menu**.",
        quickReplies: widget.simulateMode ? _customizationQuickReplies() : null,
      ),
    ];
  }

  Future<List<_ChatEntry>> _confirmMenu() async {
    if (_draft.selectedMenuItems.isEmpty) {
      return const [
        _ChatEntry.bot(
          text: 'Pick at least **one menu item** before I calculate pricing.',
        ),
      ];
    }
    if (_draft.guestCount == null || _draft.pincode == null) {
      _state = ChatState.customize;
      return [
        _ChatEntry.bot(
          text: _customizePrompt(),
          quickReplies: widget.simulateMode
              ? _customizationQuickReplies()
              : null,
        ),
      ];
    }
    return _buildPriceEntries();
  }

  Future<List<_ChatEntry>> _buildPriceEntries({String? preface}) async {
    if (!widget.simulateMode) {
      _livePriceQuote = await _generateLivePriceQuote();
    }
    final resolvedPerPlate = widget.simulateMode
        ? _draft.perPlateCost
        : (_livePriceQuote?.perPlateEstimate ?? _draft.perPlateCost);
    final order = _draft.toOrder(perPlateOverride: resolvedPerPlate);
    final narrative = widget.simulateMode
        ? _simulatePriceText()
        : [_livePriceQuote?.summary, _livePriceQuote?.pricingReason]
              .whereType<String>()
              .where((part) => part.trim().isNotEmpty)
              .join(' ');
    _state = ChatState.showPrice;
    _awaitingGuestCountChange = false;
    return [
      if (preface != null) _ChatEntry.bot(text: preface),
      _ChatEntry.bot(text: narrative),
      _ChatEntry.price(order: order),
    ];
  }

  Future<List<_ChatEntry>> _returnToMenu() async {
    _state = ChatState.customize;
    return _buildMenuEntries(
      preface:
          'No problem — tweak the menu and confirm again when you want a fresh estimate.',
    );
  }

  Future<List<_ChatEntry>> _findCaterers() async {
    _state = ChatState.findCaterer;
    final resolvedPerPlate = widget.simulateMode
        ? _draft.perPlateCost
        : (_livePriceQuote?.perPlateEstimate ?? _draft.perPlateCost);
    final order = _draft.toOrder(perPlateOverride: resolvedPerPlate);
    widget.onOrderCreated?.call(order);
    final matches = widget.simulateMode
        ? _catererDb.findMatchingCaterers(order).take(3).toList()
        : await _findLiveCaterers(order);
    _state = ChatState.showCaterers;
    if (matches.isEmpty) {
      return const [
        _ChatEntry.bot(
          text:
              "I could not find a strong caterer match yet. Try changing the menu or location and I'll rerank.",
        ),
      ];
    }
    final leadNames = matches.take(2).map((c) => c.name).join(' and ');
    return [
      _ChatEntry.bot(
        text:
            'I ranked the best fits for your **${_draft.partyType ?? 'party'}**. Top matches include **$leadNames**.',
      ),
      _ChatEntry.matches(caterers: matches, order: order),
    ];
  }

  void _toggleMenuItem(MenuItem item) {
    setState(() {
      _draft.toggleItem(item);
      if (_state != ChatState.customize) _state = ChatState.customize;
    });
  }

  void _applyUserInput(String text) {
    final normalized = text.toLowerCase();
    final partyType = _matchPartyType(text);
    if (partyType != null) {
      final changedParty = _draft.partyType != partyType;
      _draft.partyType = partyType;
      _draft.selectedMenuItems.clear();
      if (changedParty) {
        _liveMenu = null;
        _livePriceQuote = null;
      }
    }
    final guestMatch = RegExp(
      r'(\d{1,4})\s*(guests|guest|people|persons|pax)?',
    ).firstMatch(normalized);
    final guestValue = guestMatch == null
        ? null
        : int.tryParse(guestMatch.group(1)!);
    if (guestValue != null && guestValue > 0 && guestValue < 5000) {
      _draft.guestCount = guestValue;
    }
    final pincodeMatch = RegExp(r'\b\d{6}\b').firstMatch(text);
    if (pincodeMatch != null) {
      _draft.pincode = pincodeMatch.group(0)!;
      _draft.location = _knownAreas[_draft.pincode] ?? 'Newtown, Kolkata';
    }
    for (final entry in _knownAreas.entries) {
      final area = entry.value.toLowerCase();
      if (normalized.contains(entry.key) ||
          normalized.contains(area) ||
          normalized.contains(area.split(',').first)) {
        _draft.pincode = entry.key;
        _draft.location = entry.value;
      }
    }
    final menu = _activeMenu;
    if (menu != null) {
      for (final item in menu.items) {
        if (normalized.contains(item.name.toLowerCase())) _draft.addItem(item);
      }
    }
  }

  String? _matchPartyType(String text) {
    final normalized = text.toLowerCase();
    for (final partyType in kPartyTypes) {
      if (normalized.contains(partyType.toLowerCase())) return partyType;
    }
    const aliases = {
      'bbq': 'BBQ Bash',
      'bollywood': 'Bollywood Night',
      'kids': 'Kids Birthday',
      'birthday': 'Kids Birthday',
      'cocktail': 'Cocktail Party',
      'italian': 'Italian Night',
      'asian': 'Asian Feast',
      'brunch': 'Brunch Party',
      'game': 'Game Night',
    };
    for (final alias in aliases.entries) {
      if (normalized.contains(alias.key)) return alias.value;
    }
    return null;
  }

  String _customizePrompt({
    bool guestChanged = false,
    bool locationChanged = false,
    bool menuChanged = false,
  }) {
    final parts = <String>[];
    if (menuChanged && _draft.selectedMenuItems.isNotEmpty) {
      parts.add(
        'Nice picks — your menu is now **₹${_draft.perPlateCost}/plate**.',
      );
    }
    if (guestChanged && _draft.guestCount != null) {
      parts.add('Got it, planning for **${_draft.guestCount} guests**.');
    }
    if (locationChanged && _draft.location != null) {
      parts.add("Perfect, I'll search around **${_draft.location}**.");
    }
    if (_draft.selectedMenuItems.isEmpty) {
      parts.add('Tap the menu card and choose at least one dish.');
    }
    if (_draft.guestCount == null) {
      parts.add('Tell me your **guest count** next.');
    }
    if (_draft.pincode == null) {
      parts.add(
        'Share the **pincode** so I can localize pricing and caterers.',
      );
    }
    if (_draft.selectedMenuItems.isNotEmpty &&
        _draft.guestCount != null &&
        _draft.pincode != null) {
      parts.add('All set — tap **Confirm Menu** or reply **Show price**.');
    }
    return parts.join(' ');
  }

  List<String> _customizationQuickReplies() {
    if (_draft.guestCount == null) return _guestQuickReplies;
    if (_draft.pincode == null) return _locationQuickReplies;
    return const ['Show price'];
  }

  String _simulatePriceText() =>
      'Your selected menu lands at **₹${_draft.perPlateCost}/plate**. For **${_draft.guestCount} guests**, that puts the estimated food total at **₹${_draft.totalEstimate}** before any venue-specific extras.';

  Future<String> _liveCustomizePrompt(
    String userMessage, {
    bool guestChanged = false,
    bool locationChanged = false,
    bool menuChanged = false,
  }) async {
    final service = widget.geminiService!;
    final menu = _activeMenu;
    final allItems =
        menu?.items.map((i) => '${i.name} (₹${i.pricePerPlate})').join(', ') ??
        '';
    final selected = _draft.selectedMenuItems.map((i) => i.name).join(', ');
    final perPlate = _draft.perPlateCost;

    final prompt =
        'You are MoodMunch AI, helping customize a ${_draft.partyType ?? 'party'} menu. '
        'Available items: $allItems. '
        'Currently selected: ${selected.isEmpty ? 'nothing yet' : selected} (₹$perPlate/plate). '
        'Guest count: ${_draft.guestCount ?? 'not set'}. Pincode: ${_draft.pincode ?? 'not set'}. '
        'User said: "$userMessage". '
        'Respond helpfully in 2-3 short sentences. Suggest specific items to add/remove if relevant. '
        'If they asked for variations, suggest 3-4 creative alternatives from the menu. '
        'If guest count or pincode is still missing, ask for it naturally. '
        'Always mention the current per-plate total if menu changed.';

    final response = await service.chatWithContext(
      _conversationHistory,
      prompt,
    );
    return response.trim().isEmpty
        ? _customizePrompt(
            guestChanged: guestChanged,
            locationChanged: locationChanged,
            menuChanged: menuChanged,
          )
        : response.trim();
  }

  Future<PartyMenu> _generateLiveMenu(String partyType) async {
    final service = widget.geminiService;
    if (service == null) {
      throw Exception('Gemini is required in real mode to generate the menu.');
    }

    final response = await service.chatWithContext(
      _conversationHistory,
      '''You are MoodMunch AI, the actual intelligence behind the app.
The user chose the party type "$partyType".
Create a curated base catering menu for Kolkata and return ONLY valid JSON in this exact shape:
{
  "partyType": "$partyType",
  "description": "one short inviting sentence",
  "items": [
    {"name": "Item name", "category": "Starters", "pricePerPlate": 80, "emoji": "🍽️"}
  ],
  "intro": "one short conversational sentence introducing the menu"
}
Rules:
- Gemini decides the dishes and prices.
- Include 12 to 18 total items.
- Use categories such as Starters, Main Course, Desserts, Drinks, Sides, Bread.
- Keep prices as integers in INR per plate.
- Pick items that genuinely fit the party type.
- Do not use markdown, commentary, or code fences outside the JSON.''',
    );

    final decoded = _decodeJsonObject(response);
    if (decoded == null) {
      throw Exception('Gemini returned an invalid menu response.');
    }

    final itemsJson = decoded['items'];
    if (itemsJson is! List) {
      throw Exception('Gemini menu was missing items.');
    }

    final items = <MenuItem>[];
    for (final rawItem in itemsJson) {
      if (rawItem is! Map<String, dynamic>) {
        continue;
      }
      final name = (rawItem['name'] as String?)?.trim() ?? '';
      final category = (rawItem['category'] as String?)?.trim() ?? '';
      final price = _parseInt(rawItem['pricePerPlate']);
      if (name.isEmpty || category.isEmpty || price == null || price <= 0) {
        continue;
      }
      items.add(
        MenuItem(
          name: name,
          category: category,
          pricePerPlate: price,
          emoji: _safeEmoji(rawItem['emoji']) ?? '🍽️',
        ),
      );
    }

    if (items.isEmpty) {
      throw Exception('Gemini did not return a usable menu.');
    }

    return PartyMenu(
      partyType: (decoded['partyType'] as String?)?.trim().isNotEmpty == true
          ? (decoded['partyType'] as String).trim()
          : partyType,
      description:
          (decoded['description'] as String?)?.trim().isNotEmpty == true
          ? (decoded['description'] as String).trim()
          : 'A MoodMunch-crafted menu tailored to your party vibe.',
      items: items,
    );
  }

  Future<_LivePriceQuote> _generateLivePriceQuote() async {
    final service = widget.geminiService;
    if (service == null) {
      throw Exception('Gemini is required in real mode to price the menu.');
    }

    final selectedItems = _draft.selectedMenuItems
        .map(
          (item) => '${item.name} (${item.category}, ₹${item.pricePerPlate})',
        )
        .join(', ');
    final response = await service.chatWithContext(
      _conversationHistory,
      '''You are MoodMunch AI pricing a catered menu for Kolkata.
Recalculate a fair price for this exact edited menu.
Return ONLY valid JSON in this exact shape:
{
  "perPlateEstimate": 420,
  "summary": "one short conversational sentence about the estimate",
  "pricingReason": "one short sentence explaining why this price is fair"
}
Context:
- Party type: ${_draft.partyType}
- Guest count: ${_draft.guestCount}
- Pincode: ${_draft.pincode}
- Selected menu items: $selectedItems
Rules:
- Base the estimate on the chosen menu, not on a generic package.
- Price must be a single integer INR per plate.
- Keep the summary and reasoning concise and useful.
- No markdown, no code fences, no extra commentary.''',
    );

    final decoded = _decodeJsonObject(response);
    if (decoded == null) {
      throw Exception('Gemini returned an invalid pricing response.');
    }

    final perPlateEstimate = _parseInt(decoded['perPlateEstimate']);
    if (perPlateEstimate == null || perPlateEstimate <= 0) {
      throw Exception('Gemini did not return a valid per-plate estimate.');
    }

    return _LivePriceQuote(
      perPlateEstimate: perPlateEstimate,
      summary: ((decoded['summary'] as String?)?.trim().isNotEmpty ?? false)
          ? (decoded['summary'] as String).trim()
          : 'MoodMunch recalculated the fair per-plate estimate for your selected menu.',
      pricingReason:
          ((decoded['pricingReason'] as String?)?.trim().isNotEmpty ?? false)
          ? (decoded['pricingReason'] as String).trim()
          : 'The estimate reflects the selected dishes, party type, and Kolkata market rates.',
    );
  }

  Future<List<Caterer>> _findLiveCaterers(CateringOrder order) async {
    final candidates = await _buildLiveCandidates(order);
    final service = widget.geminiService;
    if (service == null || candidates.isEmpty) {
      return candidates.isEmpty
          ? _catererDb.findMatchingCaterers(order).take(3).toList()
          : candidates.take(3).toList();
    }

    final candidateText = candidates
        .map(
          (c) =>
              '- ${c.name} | rating ${c.rating.toStringAsFixed(1)} | reviews ${c.reviewCount} | specialties: ${c.specialties.join(', ')} | cuisines: ${c.cuisineSpecialties.join(', ')} | price: ${c.priceRange} | summary: ${c.reviewsSummary}',
        )
        .join('\n');
    final response = await service.chatWithContext(
      _conversationHistory,
      '''You are MoodMunch AI ranking caterers for the final shortlist.
Analyze the available caterers and return ONLY valid JSON as an array like this:
[
  {
    "name": "Caterer name",
    "reviewsSummary": "one short sentence summarizing trust/review signals",
    "matchReason": "one short sentence explaining why this caterer fits the party",
    "rank": 1
  }
]
Context:
- Party type: ${_draft.partyType}
- Guest count: ${_draft.guestCount}
- Pincode: ${_draft.pincode}
- Fair per-plate estimate: ₹${order.perPlateBudget}
- Selected menu: ${_draft.selectedMenuItems.map((i) => i.name).join(', ')}
Candidates:
$candidateText
Rules:
- Rank the best 3 candidates only.
- Consider cuisine match, reviews, suitability, price range, and capacity signals.
- Use only names from the candidate list.
- Keep explanations concise but specific.
- No markdown, no code fences, no extra commentary.''',
    );
    final ranked = _parseLiveRankings(response, candidates);
    return ranked.isEmpty ? candidates.take(3).toList() : ranked;
  }

  Future<List<Caterer>> _buildLiveCandidates(CateringOrder order) async {
    final places = widget.placesService;
    if (places == null) return _catererDb.findMatchingCaterers(order);
    final coordinate =
        _knownCoordinates[order.pincode] ?? _knownCoordinates.values.first;
    final venues = await places.findNearbyCaterers(
      lat: coordinate.lat,
      lon: coordinate.lon,
      radiusMeters: 5000,
    );
    if (venues.isEmpty) return _catererDb.findMatchingCaterers(order);
    return venues.take(6).map((venue) {
      final cuisines = (venue.cuisine ?? 'Multi-cuisine')
          .split(RegExp(r'[,;/]'))
          .map((part) => part.trim())
          .where((part) => part.isNotEmpty)
          .toList();
      return Caterer(
        id: 'live-${venue.name.hashCode}',
        name: venue.name,
        ownerName: 'MoodMunch Partner',
        phone: venue.phone ?? 'Contact on request',
        address: '${order.area} · ${venue.distanceFormatted} away',
        pincode: order.pincode,
        specialties: [
          _draft.partyType ?? 'Party',
          venue.type == 'caterer' ? 'Caterer' : 'Restaurant partner',
        ],
        cuisineSpecialties: cuisines,
        serviceTypes: const ['full', 'bulk'],
        tags: [
          venue.distanceFormatted,
          if (venue.website != null) 'Website available',
        ],
        priceRange: _priceRangeForCost(order.perPlateBudget),
        logo: venue.type == 'caterer' ? '🥳' : '🍽️',
        rating: _ratingFromDistance(venue.distanceMeters),
        turnaround: venue.openingHours ?? 'Check availability',
        reviewCount: 80 + venue.name.length * 4,
        reviewsSummary:
            'Good local traction for ${cuisines.isEmpty ? 'mixed menus' : cuisines.first.toLowerCase()} and close delivery coverage.',
      );
    }).toList();
  }

  List<Caterer> _parseLiveRankings(String response, List<Caterer> candidates) {
    final jsonText = RegExp(r'\[[\s\S]*\]').firstMatch(response)?.group(0);
    if (jsonText == null) return const [];
    try {
      final decoded = json.decode(jsonText) as List<dynamic>;
      final byName = {
        for (final caterer in candidates) caterer.name.toLowerCase(): caterer,
      };
      final ranked = <Caterer>[];
      for (final entry in decoded) {
        if (entry is! Map<String, dynamic>) continue;
        final key = (entry['name'] as String? ?? '').trim().toLowerCase();
        final caterer = byName[key];
        if (caterer == null) continue;
        ranked.add(
          caterer.copyWith(
            reviewsSummary:
                ((entry['reviewsSummary'] as String?)?.trim().isNotEmpty ??
                    false)
                ? (entry['reviewsSummary'] as String).trim()
                : caterer.reviewsSummary,
            matchReason:
                ((entry['matchReason'] as String?)?.trim().isNotEmpty ?? false)
                ? (entry['matchReason'] as String).trim()
                : caterer.matchReason,
          ),
        );
      }
      return ranked;
    } catch (_) {
      return const [];
    }
  }

  Set<MenuItem> _defaultSelectedItems(PartyMenu menu) {
    final grouped = <String, List<MenuItem>>{};
    for (final item in menu.items) {
      grouped.putIfAbsent(item.category, () => <MenuItem>[]).add(item);
    }
    final selected = <MenuItem>{};
    for (final entry in grouped.values) {
      final targetCount = math.max(1, (entry.length * 0.6).round());
      selected.addAll(entry.take(targetCount));
    }
    return selected;
  }

  Map<String, dynamic>? _decodeJsonObject(String response) {
    final jsonText = RegExp(r'\{[\s\S]*\}').firstMatch(response)?.group(0);
    if (jsonText == null) {
      return null;
    }
    try {
      return json.decode(jsonText) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  String? _safeEmoji(Object? value) {
    if (value == null) {
      return null;
    }
    final text = value.toString().trim();
    if (text.isEmpty || text.length > 8) {
      return null;
    }
    return text;
  }

  int? _parseInt(Object? value) {
    if (value == null) {
      return null;
    }
    if (value is int) {
      return value;
    }
    return int.tryParse(value.toString().replaceAll(RegExp(r'[^0-9]'), ''));
  }

  double _ratingFromDistance(double distanceMeters) {
    final normalized = 4.9 - (distanceMeters / 10000);
    return normalized.clamp(4.1, 4.9);
  }

  String _priceRangeForCost(int cost) {
    if (cost >= 650) return '₹₹₹₹';
    if (cost >= 400) return '₹₹₹';
    return '₹₹';
  }

  bool _looksLikeConfirm(String text) {
    final lower = text.toLowerCase();
    return lower.contains('confirm') || lower.contains('ready');
  }

  bool _looksLikeShowPrice(String text) {
    final lower = text.toLowerCase();
    return lower.contains('show price') ||
        lower.contains('price') ||
        lower.contains('estimate');
  }

  bool _looksLikeFindCaterer(String text) {
    final lower = text.toLowerCase();
    return lower.contains('find caterer') ||
        lower.contains('find catering') ||
        lower.contains('show caterer') ||
        lower.contains('caterer');
  }

  bool _looksLikeChangeMenu(String text) {
    final lower = text.toLowerCase();
    return lower.contains('change menu') ||
        lower.contains('edit menu') ||
        lower.contains('customize');
  }

  bool _looksLikeChangeGuestCount(String text) {
    final lower = text.toLowerCase();
    return lower.contains('change guest') ||
        lower.contains('edit guest') ||
        lower.contains('guest count');
  }

  void _showContactSnackBar(Caterer caterer) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Call ${caterer.ownerName} at ${caterer.phone} · ${caterer.address}',
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        titleSpacing: 0,
        title: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
                ),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Text('👩‍🍳', style: TextStyle(fontSize: 18)),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'MoodMunch',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    'Online · Party Menu Planner',
                    style: TextStyle(fontSize: 11, color: Colors.white70),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Quick theme search',
            onPressed: widget.onBrowseThemesTap,
            icon: const Icon(Icons.grid_view_rounded),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF140A2E), Color(0xFF0F172A), Color(0xFF111827)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  itemCount: _messages.length,
                  itemBuilder: (context, index) {
                    final message = _messages[index];
                    final latestAssistant =
                        index == _messages.length - 1 &&
                        message.role == MessageRole.assistant;
                    return _buildMessageItem(message, latestAssistant);
                  },
                ),
              ),
              _Composer(
                controller: _inputController,
                isLoading: _isLoading,
                onSend: _sendMessage,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMessageItem(_ChatEntry message, bool isLatestAssistant) {
    switch (message.type) {
      case _ChatEntryType.typing:
        return const _BotShell(child: _TypingIndicator());
      case _ChatEntryType.menu:
        return _BotShell(
          child: MenuCard(
            menu: message.menu!,
            selectedItems: _draft.selectedMenuItems,
            onToggle: _toggleMenuItem,
            onConfirmMenu: _isLoading
                ? () {}
                : () => _runCardAction('Confirm Menu', _confirmMenu),
            onCustomize: _isLoading
                ? () {}
                : () => _runCardAction('Customize Menu', () async {
                    _state = ChatState.customize;
                    return [
                      _ChatEntry.bot(
                        text: _customizePrompt(menuChanged: true),
                        quickReplies: widget.simulateMode
                            ? _customizationQuickReplies()
                            : null,
                      ),
                    ];
                  }),
          ),
        );
      case _ChatEntryType.price:
        final order = message.order!;
        return _BotShell(
          child: PriceCard(
            partyType: _draft.partyType ?? order.eventType,
            perPlateCost: order.perPlateBudget,
            guestCount: order.guestCount,
            totalEstimate: order.perPlateBudget * order.guestCount,
            locationLabel: '${order.area} · ${order.pincode}',
            onFindCaterer: _isLoading
                ? () {}
                : () => _runCardAction('Find Caterer', _findCaterers),
            onChangeMenu: _isLoading
                ? () {}
                : () => _runCardAction('Change Menu', _returnToMenu),
            onChangeGuestCount: _isLoading
                ? () {}
                : () => _runCardAction('Change guest count', () async {
                    _awaitingGuestCountChange = true;
                    return [
                      _ChatEntry.bot(
                        text:
                            "Send the new **guest count** and I'll instantly refresh the estimate.",
                        quickReplies: widget.simulateMode
                            ? _guestQuickReplies
                            : null,
                      ),
                    ];
                  }),
          ),
        );
      case _ChatEntryType.matches:
        return _BotShell(
          child: Column(
            children: message.caterers!
                .map(
                  (caterer) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: CatererMatchCard(
                      caterer: caterer,
                      onContact: () => _showContactSnackBar(caterer),
                    ),
                  ),
                )
                .toList(),
          ),
        );
      case _ChatEntryType.text:
        if (message.role == MessageRole.user) {
          return Align(
            alignment: Alignment.centerRight,
            child: Container(
              margin: const EdgeInsets.only(left: 52, bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
                ),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(18),
                  topRight: Radius.circular(18),
                  bottomLeft: Radius.circular(18),
                  bottomRight: Radius.circular(4),
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF7C3AED).withValues(alpha: 0.35),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: _MarkdownText(
                text: message.text ?? '',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  height: 1.45,
                ),
              ),
            ),
          );
        }
        return _BotShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xF01E293B),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.08),
                  ),
                ),
                child: _MarkdownText(
                  text: message.text ?? '',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    height: 1.5,
                  ),
                ),
              ),
              if ((message.quickReplies?.isNotEmpty ?? false) &&
                  isLatestAssistant &&
                  widget.simulateMode)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: message.quickReplies!
                        .map(
                          (reply) => ActionChip(
                            side: BorderSide(
                              color: const Color(
                                0xFF8B5CF6,
                              ).withValues(alpha: 0.8),
                            ),
                            backgroundColor: Colors.transparent,
                            labelStyle: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                            onPressed: _isLoading
                                ? null
                                : () => _sendMessage(reply),
                            label: Text(reply),
                          ),
                        )
                        .toList(),
                  ),
                ),
            ],
          ),
        );
    }
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.isLoading,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool isLoading;
  final ValueChanged<String> onSend;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 18),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.14),
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.06)),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              enabled: !isLoading,
              minLines: 1,
              maxLines: 4,
              style: const TextStyle(color: Colors.white),
              onSubmitted: onSend,
              decoration: InputDecoration(
                hintText: 'Type your party details…',
                hintStyle: TextStyle(
                  color: Colors.white.withValues(alpha: 0.48),
                ),
                filled: true,
                fillColor: const Color(0xF01E293B),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 14,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: BorderSide(
                    color: Colors.white.withValues(alpha: 0.08),
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: BorderSide(
                    color: Colors.white.withValues(alpha: 0.08),
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: const BorderSide(
                    color: Color(0xFF8B5CF6),
                    width: 1.5,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          InkWell(
            onTap: isLoading ? null : () => onSend(controller.text),
            borderRadius: BorderRadius.circular(18),
            child: Ink(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                gradient: isLoading
                    ? const LinearGradient(
                        colors: [Color(0xFF475569), Color(0xFF334155)],
                      )
                    : const LinearGradient(
                        colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
                      ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(
                isLoading ? Icons.hourglass_top_rounded : Icons.send_rounded,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BotShell extends StatelessWidget {
  const _BotShell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            alignment: Alignment.center,
            child: const Text('👩‍🍳', style: TextStyle(fontSize: 16)),
          ),
          const SizedBox(width: 10),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _MarkdownText extends StatelessWidget {
  const _MarkdownText({required this.text, required this.style});

  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final spans = <InlineSpan>[];
    final regex = RegExp(r'\*\*(.*?)\*\*');
    var currentIndex = 0;
    for (final match in regex.allMatches(text)) {
      if (match.start > currentIndex) {
        spans.add(TextSpan(text: text.substring(currentIndex, match.start)));
      }
      spans.add(
        TextSpan(
          text: match.group(1),
          style: style.copyWith(fontWeight: FontWeight.w800),
        ),
      );
      currentIndex = match.end;
    }
    if (currentIndex < text.length) {
      spans.add(TextSpan(text: text.substring(currentIndex)));
    }
    return RichText(
      text: TextSpan(style: style, children: spans),
    );
  }
}

class _TypingIndicator extends StatefulWidget {
  const _TypingIndicator();

  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xF01E293B),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(3, (index) {
              final phase = (_controller.value + index * 0.15) % 1;
              final scale = 0.75 + math.sin(phase * math.pi) * 0.35;
              return Padding(
                padding: EdgeInsets.only(right: index == 2 ? 0 : 6),
                child: Transform.scale(
                  scale: scale,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.85),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              );
            }),
          );
        },
      ),
    );
  }
}

class _ChatEntry {
  const _ChatEntry({
    required this.type,
    required this.role,
    this.text,
    this.quickReplies,
    this.order,
    this.caterers,
    this.menu,
  });

  const _ChatEntry.user({required String text})
    : this(type: _ChatEntryType.text, role: MessageRole.user, text: text);
  const _ChatEntry.bot({required String text, List<String>? quickReplies})
    : this(
        type: _ChatEntryType.text,
        role: MessageRole.assistant,
        text: text,
        quickReplies: quickReplies,
      );
  const _ChatEntry.menu({required PartyMenu menu})
    : this(type: _ChatEntryType.menu, role: MessageRole.assistant, menu: menu);
  const _ChatEntry.price({required CateringOrder order})
    : this(
        type: _ChatEntryType.price,
        role: MessageRole.assistant,
        order: order,
      );
  const _ChatEntry.matches({
    required List<Caterer> caterers,
    required CateringOrder order,
  }) : this(
         type: _ChatEntryType.matches,
         role: MessageRole.assistant,
         caterers: caterers,
         order: order,
       );
  const _ChatEntry.typing()
    : this(type: _ChatEntryType.typing, role: MessageRole.assistant);

  final _ChatEntryType type;
  final MessageRole role;
  final String? text;
  final List<String>? quickReplies;
  final CateringOrder? order;
  final List<Caterer>? caterers;
  final PartyMenu? menu;
}

enum _ChatEntryType { text, menu, price, matches, typing }

class _OrderDraft {
  String? partyType;
  final List<MenuItem> selectedMenuItems = [];
  int? guestCount;
  String? location;
  String? pincode;

  int get perPlateCost =>
      selectedMenuItems.fold(0, (sum, item) => sum + item.pricePerPlate);
  int get totalEstimate => perPlateCost * (guestCount ?? 0);

  void toggleItem(MenuItem item) {
    final index = selectedMenuItems.indexWhere(
      (selected) => selected.name == item.name,
    );
    if (index >= 0) {
      selectedMenuItems.removeAt(index);
    } else {
      selectedMenuItems.add(item);
    }
  }

  void addItem(MenuItem item) {
    if (!selectedMenuItems.any((selected) => selected.name == item.name)) {
      selectedMenuItems.add(item);
    }
  }

  void reset() {
    partyType = null;
    selectedMenuItems.clear();
    guestCount = null;
    location = null;
    pincode = null;
  }

  CateringOrder toOrder({int? perPlateOverride}) {
    final resolvedPartyType = partyType ?? 'Party';
    final resolvedArea = location ?? _knownAreas[pincode] ?? 'Newtown, Kolkata';
    final resolvedPincode = pincode ?? '700156';
    final resolvedGuests = guestCount ?? 1;
    final resolvedPerPlate = perPlateOverride ?? perPlateCost;
    return CateringOrder(
      id: 'order-${DateTime.now().millisecondsSinceEpoch}',
      serviceType: 'full',
      eventType: resolvedPartyType,
      guestCount: resolvedGuests,
      perPlateBudget: resolvedPerPlate,
      menuItems: selectedMenuItems.map((item) => item.name).toList(),
      pincode: resolvedPincode,
      area: resolvedArea,
      summary:
          '$resolvedPartyType for $resolvedGuests guests in $resolvedArea ($resolvedPincode) at ₹$resolvedPerPlate/plate.',
      placedAt: DateTime.now(),
    );
  }
}

class _LivePriceQuote {
  const _LivePriceQuote({
    required this.perPlateEstimate,
    required this.summary,
    required this.pricingReason,
  });

  final int perPlateEstimate;
  final String summary;
  final String pricingReason;
}

class _KnownCoordinate {
  const _KnownCoordinate(this.lat, this.lon);

  final double lat;
  final double lon;
}