import 'package:flutter/material.dart';

class AppTheme {
  static const _primaryColor = Color(0xFF7C3AED);
  static const _secondaryColor = Color(0xFFEC4899);
  static const _tertiaryColor = Color(0xFFF59E0B);
  static const _lightBackground = Color(0xFFFAF5FF);
  static const _lightSurface = Color(0xFFF3E8FF);
  static const _lightSurfaceVariant = Color(0xFFE9D5FF);
  static const _darkBackground = Color(0xFF140A2E);
  static const _darkSurface = Color(0xFF241046);
  static const _darkSurfaceVariant = Color(0xFF362066);

  static ThemeData get lightTheme {
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: _primaryColor,
      onPrimary: Colors.white,
      primaryContainer: Color(0xFFE9D5FF),
      onPrimaryContainer: Color(0xFF2E1065),
      secondary: _secondaryColor,
      onSecondary: Colors.white,
      secondaryContainer: Color(0xFFFBCFE8),
      onSecondaryContainer: Color(0xFF831843),
      tertiary: _tertiaryColor,
      onTertiary: Color(0xFF3B2200),
      tertiaryContainer: Color(0xFFFDE68A),
      onTertiaryContainer: Color(0xFF5F3700),
      error: Color(0xFFB3261E),
      onError: Colors.white,
      errorContainer: Color(0xFFF9DEDC),
      onErrorContainer: Color(0xFF410E0B),
      surface: _lightSurface,
      onSurface: Color(0xFF221433),
      surfaceContainerHighest: _lightSurfaceVariant,
      onSurfaceVariant: Color(0xFF5B4B6A),
      outline: Color(0xFFD8B4FE),
      outlineVariant: Color(0xFFE9D5FF),
      shadow: Color(0x33000000),
      scrim: Color(0x66000000),
      inverseSurface: Color(0xFF2D1B45),
      onInverseSurface: Color(0xFFF8EEFF),
      inversePrimary: Color(0xFFC4B5FD),
      surfaceTint: _primaryColor,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: _lightBackground,
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        elevation: 0,
        scrolledUnderElevation: 1,
        backgroundColor: _lightBackground,
        foregroundColor: Color(0xFF221433),
        titleTextStyle: TextStyle(
          color: Color(0xFF221433),
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(28),
          borderSide: const BorderSide(color: Color(0xFFE9D5FF)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(28),
          borderSide: const BorderSide(color: Color(0xFFE9D5FF)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(28),
          borderSide: const BorderSide(color: _primaryColor, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 14,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          shape: const CircleBorder(),
          padding: const EdgeInsets.all(14),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: _primaryColor,
          foregroundColor: Colors.white,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: Colors.white,
        shadowColor: const Color(0x14000000),
      ),
    );
  }

  static ThemeData get darkTheme {
    const colorScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: Color(0xFFC4B5FD),
      onPrimary: Color(0xFF2E1065),
      primaryContainer: Color(0xFF5B21B6),
      onPrimaryContainer: Color(0xFFF3E8FF),
      secondary: Color(0xFFF472B6),
      onSecondary: Color(0xFF500724),
      secondaryContainer: Color(0xFF9D174D),
      onSecondaryContainer: Color(0xFFFCE7F3),
      tertiary: Color(0xFFFBBF24),
      onTertiary: Color(0xFF422006),
      tertiaryContainer: Color(0xFF92400E),
      onTertiaryContainer: Color(0xFFFFF3C4),
      error: Color(0xFFF2B8B5),
      onError: Color(0xFF601410),
      errorContainer: Color(0xFF8C1D18),
      onErrorContainer: Color(0xFFF9DEDC),
      surface: _darkSurface,
      onSurface: Color(0xFFF8EEFF),
      surfaceContainerHighest: _darkSurfaceVariant,
      onSurfaceVariant: Color(0xFFD8C7F0),
      outline: Color(0xFF8B5CF6),
      outlineVariant: Color(0xFF4C1D95),
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: Color(0xFFF3E8FF),
      onInverseSurface: Color(0xFF241046),
      inversePrimary: _primaryColor,
      surfaceTint: Color(0xFFC4B5FD),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: _darkBackground,
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        elevation: 0,
        scrolledUnderElevation: 1,
        backgroundColor: _darkBackground,
        foregroundColor: Color(0xFFF8EEFF),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: _darkSurface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(28),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(28),
          borderSide: const BorderSide(color: Color(0xFF4C1D95)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(28),
          borderSide: const BorderSide(color: Color(0xFFC4B5FD), width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 14,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          shape: const CircleBorder(),
          padding: const EdgeInsets.all(14),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF8B5CF6),
          foregroundColor: Colors.white,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: _darkSurface,
      ),
    );
  }
}
