# Hourly Habit Tracker (Expo React Native)

A mobile app that reminds the user every hour to log what they did in the last hour.

## Features
- Hourly repeating notification reminder.
- Quick notification actions: **Work**, **Deep Work**, **Wasted**, **Job**.
- Manual in-app check-in with notes.
- Daily overview with awake hours, wasted hours, productive hours.
- Simple hour-based graph by category.
- Local persistent storage using AsyncStorage.

## Setup
```bash
npm install
npm run start
```

Then run on Android/iOS using Expo Go or simulator.

## Notes about notification action buttons
Interactive action buttons are configured through `expo-notifications` category actions. Platform support/behavior may vary slightly between Android and iOS and between development and production builds.
