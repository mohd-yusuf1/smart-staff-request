import { Stack } from 'expo-router';

import { StoreProvider } from '../state/store';

export default function RootLayout() {
  return (
    <StoreProvider>
      <Stack />
    </StoreProvider>
  );
}
