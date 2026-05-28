import 'dart:math';
import 'package:flutter/material.dart';

class SplashScreen extends StatefulWidget {
  final VoidCallback onComplete;

  const SplashScreen({super.key, required this.onComplete});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _logoController;
  late final AnimationController _foodRainController;
  late final AnimationController _textController;
  late final AnimationController _glowController;
  late final AnimationController _pulseController;
  late final Animation<double> _logoScale;
  late final Animation<double> _textOpacity;
  late final Animation<Offset> _textSlide;

  final _foodEmojis = [
    '🎉',
    '🎊',
    '🎈',
    '🍕',
    '🍔',
    '🎂',
    '🍸',
    '🥂',
    '🎮',
    '💃',
    '🎵',
    '🌮',
    '🍝',
    '🔥',
    '🥳',
  ];
  late final List<_FallingFood> _fallingFoods;

  @override
  void initState() {
    super.initState();

    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _logoScale = CurvedAnimation(
      parent: _logoController,
      curve: Curves.elasticOut,
    );

    _foodRainController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    final random = Random();
    _fallingFoods = List.generate(25, (i) {
      return _FallingFood(
        emoji: _foodEmojis[random.nextInt(_foodEmojis.length)],
        x: random.nextDouble(),
        speed: 0.3 + random.nextDouble() * 0.7,
        delay: random.nextDouble(),
        size: 24.0 + random.nextDouble() * 20,
        wobble: random.nextDouble() * 2 - 1,
        rotation: random.nextDouble() * 0.5 - 0.25,
      );
    });

    _textController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _textOpacity = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _textController, curve: Curves.easeIn));
    _textSlide = Tween<Offset>(begin: const Offset(0, 0.4), end: Offset.zero)
        .animate(
          CurvedAnimation(parent: _textController, curve: Curves.easeOutCubic),
        );

    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);

    _startSequence();
  }

  bool _ready = false;

  Future<void> _startSequence() async {
    await Future.delayed(Duration.zero);
    _logoController.forward();
    await Future.delayed(const Duration(milliseconds: 300));
    _textController.forward();
    await Future.delayed(const Duration(milliseconds: 300));
    if (mounted) setState(() => _ready = true);
  }

  @override
  void dispose() {
    _logoController.dispose();
    _foodRainController.dispose();
    _textController.dispose();
    _glowController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GestureDetector(
        onTap: _ready ? widget.onComplete : null,
        child: Container(
          decoration: const BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(0, -0.3),
              radius: 1.2,
              colors: [Color(0xFFEC4899), Color(0xFF7C3AED), Color(0xFF2E1065)],
              stops: [0.0, 0.58, 1.0],
            ),
          ),
          child: Stack(
            children: [
              AnimatedBuilder(
                animation: _foodRainController,
                builder: (context, _) => CustomPaint(
                  size: MediaQuery.of(context).size,
                  painter: _FoodRainPainter(
                    foods: _fallingFoods,
                    progress: _foodRainController.value,
                  ),
                ),
              ),
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    AnimatedBuilder(
                      animation: _glowController,
                      builder: (context, child) {
                        return Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Color.fromRGBO(
                                  236,
                                  72,
                                  153,
                                  0.35 + (_glowController.value * 0.35),
                                ),
                                blurRadius: 40 + (_glowController.value * 30),
                                spreadRadius: 10 + (_glowController.value * 15),
                              ),
                            ],
                          ),
                          child: child,
                        );
                      },
                      child: ScaleTransition(
                        scale: _logoScale,
                        child: Container(
                          width: 160,
                          height: 160,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                Color(0xFFA78BFA),
                                Color(0xFF7C3AED),
                                Color(0xFFEC4899),
                              ],
                            ),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Color.fromRGBO(255, 255, 255, 0.3),
                              width: 3,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Color.fromRGBO(0, 0, 0, 0.3),
                                blurRadius: 20,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Text('🥳', style: TextStyle(fontSize: 72)),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 48),
                    SlideTransition(
                      position: _textSlide,
                      child: FadeTransition(
                        opacity: _textOpacity,
                        child: Column(
                          children: [
                            const Text(
                              'MoodMunch',
                              style: TextStyle(
                                fontSize: 48,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: -1.5,
                                shadows: [
                                  Shadow(
                                    color: Color(0x80000000),
                                    blurRadius: 10,
                                    offset: Offset(0, 4),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: Color.fromRGBO(255, 255, 255, 0.15),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: Color.fromRGBO(255, 255, 255, 0.2),
                                ),
                              ),
                              child: const Text(
                                'powered by Radhuni ✨',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.white70,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                            const SizedBox(height: 32),
                            AnimatedBuilder(
                              animation: _pulseController,
                              builder: (context, child) {
                                return Transform.scale(
                                  scale: 1.0 + _pulseController.value * 0.05,
                                  child: child,
                                );
                              },
                              child: const Text(
                                '🎉 Party planning made delicious!',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (_ready)
                Positioned(
                  bottom: 60,
                  left: 40,
                  right: 40,
                  child: GestureDetector(
                    onTap: widget.onComplete,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(30),
                        boxShadow: [
                          BoxShadow(
                            color: Color.fromRGBO(0, 0, 0, 0.2),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            "Let's Partyyyy! 🎉",
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF7C3AED),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FallingFood {
  final String emoji;
  final double x;
  final double speed;
  final double delay;
  final double size;
  final double wobble;
  final double rotation;

  _FallingFood({
    required this.emoji,
    required this.x,
    required this.speed,
    required this.delay,
    required this.size,
    required this.wobble,
    required this.rotation,
  });
}

class _FoodRainPainter extends CustomPainter {
  final List<_FallingFood> foods;
  final double progress;

  _FoodRainPainter({required this.foods, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    for (final food in foods) {
      final adjustedProgress = (progress * food.speed + food.delay) % 1.0;
      final y = -60.0 + adjustedProgress * (size.height + 120);
      final x =
          food.x * size.width +
          sin(adjustedProgress * pi * 2) * 25 * food.wobble;

      final textPainter = TextPainter(
        text: TextSpan(
          text: food.emoji,
          style: TextStyle(fontSize: food.size),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      final opacity =
          (1.0 - (adjustedProgress - 0.7).clamp(0.0, 0.3) / 0.3) * 0.8;
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(food.rotation * sin(adjustedProgress * pi * 2));
      canvas.saveLayer(
        Rect.fromLTWH(0, 0, textPainter.width, textPainter.height),
        Paint()..color = Color.fromRGBO(255, 255, 255, opacity),
      );
      textPainter.paint(canvas, Offset.zero);
      canvas.restore();
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _FoodRainPainter oldDelegate) => true;
}
