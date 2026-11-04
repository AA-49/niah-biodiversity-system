import { useRouter } from 'expo-router';

import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';

/** The Home tab for visitors. Scanning a tag is the main thing they do, so it comes first. */
export function VisitorHome() {
  const router = useRouter();

  return (
    <Screen
      eyebrow="Niah National Park"
      title="Plant guide"
      subtitle="Scan the QR tag on a plant to read about it.">
      <Button label="Scan a plant tag" icon="scan" onPress={() => router.navigate('/scan')} />
    </Screen>
  );
}
