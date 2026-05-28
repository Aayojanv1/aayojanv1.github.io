import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import 'models/catering_order.dart';
import 'models/food_mood.dart';
import 'models/restaurant_result.dart';
import 'screens/chat_screen.dart';
import 'screens/mood_picker_screen.dart';
import 'screens/results_screen.dart';
import 'screens/splash_screen.dart';
import 'services/gemini_service.dart';
import 'services/mock_services.dart';
import 'services/places_service.dart';
import 'theme/app_theme.dart';
import 'widgets/searching_animation.dart';

const bool _forceSimulate = bool.fromEnvironment('SIMULATE', defaultValue: false);
// API key injected at build time via --dart-define=GEMINI_API_KEY=...
const String kGeminiApiKey = String.fromEnvironment('GEMINI_API_KEY');
// Simulate if forced OR if no API key provided
final bool kSimulateMode = _forceSimulate || kGeminiApiKey.isEmpty;

void main() {
  runApp(const MoodMunchApp());
}

class MoodMunchApp extends StatefulWidget {
  const MoodMunchApp({super.key});

  @override
  State<MoodMunchApp> createState() => _MoodMunchAppState();
}

enum AppState { splash, apiKey, themePicker, chat, searching, results, error }

class _MoodMunchAppState extends State<MoodMunchApp> {
  GeminiService? _geminiService;
  final _placesService = PlacesService();
  final _apiKeyController = TextEditingController();
  AppState _appState = AppState.splash;
  String _searchStatus = '';
  PartyTheme? _selectedTheme;
  List<RestaurantResult> _results = [];
  String _errorMessage = '';
  int _guestCount = 0;
  CateringOrder? _latestOrder;

  @override
  void dispose() {
    _apiKeyController.dispose();
    super.dispose();
  }

  void _initializeService(String apiKey) {
    setState(() {
      _geminiService = GeminiService(apiKey: apiKey);
      _appState = AppState.chat;
    });
  }

  void _handleOrderCreated(CateringOrder order) {
    setState(() {
      _latestOrder = order;
    });
  }

  Future<void> _onThemeSelected(PartyTheme theme) async {
    final guestCount = theme.suggestedGuests;

    setState(() {
      _selectedTheme = theme;
      _guestCount = guestCount;
      _appState = AppState.searching;
      _searchStatus =
          '🎉 Planning your ${theme.label} party for $guestCount guests...';
    });

    try {
      double lat;
      double lon;

      if (kSimulateMode) {
        await Future.delayed(const Duration(milliseconds: 800));
        lat = 12.9716;
        lon = 77.5946;
      } else {
        final position = await _getLocation();
        lat = position.latitude;
        lon = position.longitude;
      }

      setState(
        () => _searchStatus = '📍 Finding restaurants & caterers near you...',
      );

      List<Restaurant> restaurants;
      if (kSimulateMode) {
        final mockPlaces = MockPlacesService();
        restaurants = await mockPlaces.findNearbyRestaurants(
          lat: lat,
          lon: lon,
          radiusMeters: 5000,
        );
      } else {
        final placesService = PlacesService();
        restaurants = await placesService.findNearbyRestaurants(
          lat: lat,
          lon: lon,
          radiusMeters: 5000,
        );
      }

      if (restaurants.isEmpty) {
        setState(() {
          _appState = AppState.error;
          _errorMessage =
              'No restaurants or caterers found within 5km. Try again in a different location!';
        });
        return;
      }

      setState(() {
        _searchStatus =
            '🎉 MoodMunch is matching ${restaurants.length} options to your party theme for $guestCount guests...';
      });

      final restaurantData = restaurants
          .take(40)
          .map((r) {
            return '- ${r.name} | Type: ${r.type} | Cuisine: ${r.cuisine ?? "unknown"} | Distance: ${r.distanceFormatted}';
          })
          .join('\n');

      String response;
      if (kSimulateMode) {
        final mockGemini = MockGeminiService();
        response = await mockGemini.rankRestaurants(
          mood:
              '${theme.label} party theme for $guestCount guests - ${theme.description}',
          restaurantList: restaurantData,
        );
      } else {
        response = await _geminiService!.rankRestaurants(
          mood:
              '${theme.label} party theme for $guestCount guests - ${theme.description}',
          restaurantList: restaurantData,
        );
      }

      final results = RestaurantResult.parseResults(response);

      if (results.isEmpty) {
        setState(() {
          _appState = AppState.error;
          _errorMessage =
              'Could not parse party recommendations. Please try again.';
        });
        return;
      }

      setState(() {
        _results = results;
        _appState = AppState.results;
      });
    } catch (e) {
      setState(() {
        _appState = AppState.error;
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  Future<Position> _getLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('Location services are disabled. Please enable them.');
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw Exception(
          'Location permission denied. Please allow location access.',
        );
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw Exception(
        'Location permissions permanently denied. Enable in browser settings.',
      );
    }

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
      ),
    );
  }

  void _startOver() {
    setState(() {
      _appState = AppState.chat;
      _results = [];
      _selectedTheme = null;
      _errorMessage = '';
      _guestCount = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AayojanAI',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: _buildCurrentScreen(),
    );
  }

  Widget _buildCurrentScreen() {
    switch (_appState) {
      case AppState.splash:
        return SplashScreen(
          onComplete: () {
            setState(() {
              if (!kSimulateMode && kGeminiApiKey.isNotEmpty) {
                _geminiService = GeminiService(apiKey: kGeminiApiKey);
              }
              _appState = AppState.chat;
            });
          },
        );
      case AppState.apiKey:
        return _buildApiKeyScreen();
      case AppState.themePicker:
        return MoodPickerScreen(
          onThemeSelected: _onThemeSelected,
          onChatTap: () => setState(() => _appState = AppState.chat),
          onBack: () => setState(() => _appState = AppState.chat),
        );
      case AppState.chat:
        return ChatScreen(
          onBrowseThemesTap: () =>
              setState(() => _appState = AppState.themePicker),
          onOrderCreated: _handleOrderCreated,
          simulateMode: kSimulateMode,
          geminiService: kSimulateMode ? null : _geminiService,
          placesService: kSimulateMode ? null : _placesService,
        );
      case AppState.searching:
        return _buildSearchingScreen();
      case AppState.results:
        return ResultsScreen(
          theme: _selectedTheme!,
          results: _results,
          onStartOver: _startOver,
        );
      case AppState.error:
        return _buildErrorScreen();
    }
  }

  Widget _buildSearchingScreen() {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                _selectedTheme?.emoji ?? '🎉',
                style: const TextStyle(fontSize: 64),
              ),
              const SizedBox(height: 24),
              Text(
                _selectedTheme?.label ?? 'Searching...',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Finding party-ready restaurants & caterers for $_guestCount guests',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Theme.of(
                    context,
                  ).colorScheme.onSurface.withValues(alpha: 0.7),
                ),
              ),
              if (_latestOrder != null) ...[
                const SizedBox(height: 12),
                Text(
                  'Last chat order: ${_latestOrder!.area}',
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.55),
                  ),
                ),
              ],
              const SizedBox(height: 32),
              SearchingAnimation(message: _searchStatus),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildErrorScreen() {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('😕', style: TextStyle(fontSize: 64)),
              const SizedBox(height: 24),
              const Text(
                'Oops!',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              Text(
                _errorMessage,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  color: colorScheme.onSurface.withValues(alpha: 0.7),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              FilledButton.icon(
                onPressed: _startOver,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try Again'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(200, 50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildApiKeyScreen() {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF7C3AED).withValues(alpha: 0.28),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Text('🤖', style: TextStyle(fontSize: 48)),
                ),
                const SizedBox(height: 32),
                const Text(
                  'MoodMunch',
                  style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(
                  'Chat-first party planning with MoodMunch AI, plus quick theme search when you want it.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    color: Colors.grey.shade400,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _apiKeyController,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'Gemini API Key',
                    hintText: 'Paste your key from ai.google.dev',
                    prefixIcon: const Icon(Icons.key_rounded),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: FilledButton.icon(
                    onPressed: () {
                      final key = _apiKeyController.text.trim();
                      if (key.isNotEmpty) {
                        _initializeService(key);
                      }
                    },
                    icon: const Icon(Icons.chat_bubble_rounded),
                    label: const Text(
                      'Open MoodMunch AI',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: FilledButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
