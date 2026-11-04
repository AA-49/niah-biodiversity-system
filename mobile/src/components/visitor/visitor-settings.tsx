import { AboutCard } from '@/components/about-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSwitchMode } from '@/hooks/use-switch-mode';

/**
 * The Settings tab for visitors. It sits where staff have their profile, since visitors have no
 * account.
 */
export function VisitorSettings() {
  const { switchTo, switching, error } = useSwitchMode();

  return (
    <Screen title="Settings">
      <Card title="Work at the park?" icon="staff">
        <ThemedText type="small" themeColor="textSecondary">
          Staff can record plants and send them to the team. You&apos;ll sign in with your staff
          account.
        </ThemedText>
        {error ? (
          <ThemedText type="small" themeColor="danger" role="alert">
            {error}
          </ThemedText>
        ) : null}
        <Button
          label="I work at the park"
          icon="staff"
          variant="outline"
          disabled={switching}
          onPress={() => switchTo('staff')}
        />
      </Card>

      <AboutCard />
    </Screen>
  );
}
