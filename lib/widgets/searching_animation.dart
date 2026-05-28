import 'dart:math';
import 'package:flutter/material.dart';

class SearchingAnimation extends StatefulWidget {
  final String message;

  const SearchingAnimation({
    super.key,
    this.message = 'Finding restaurants near you...',
  });

  @override
  State<SearchingAnimation> createState() => _SearchingAnimationState();
}

class _SearchingAnimationState extends State<SearchingAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  final _foodEmojis = ['🍕', '🍜', '🍔', '🥗', '🍣', '🌮'];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colorScheme.primaryContainer.withValues(alpha: 0.3),
            colorScheme.secondaryContainer.withValues(alpha: 0.3),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colorScheme.primary.withValues(alpha: 0.2)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 50,
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, _) {
                return Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(6, (i) {
                    final offset =
                        sin((_controller.value * 2 * pi) + (i * 0.8)) * 8;
                    return Transform.translate(
                      offset: Offset(0, offset),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Text(
                          _foodEmojis[i],
                          style: const TextStyle(fontSize: 24),
                        ),
                      ),
                    );
                  }),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          Text(
            widget.message,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: colorScheme.onSurface,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              minHeight: 3,
              backgroundColor: colorScheme.primary.withValues(alpha: 0.1),
              valueColor: AlwaysStoppedAnimation(colorScheme.primary),
            ),
          ),
        ],
      ),
    );
  }
}
