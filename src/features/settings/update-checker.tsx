import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { UpdateStatus } from '@/lib/updater'

interface UpdateCheckerProps {
  appVersion: string
  status: UpdateStatus
  onCheck: () => void
  onInstall: () => void
  onRestart: () => void
}

export function UpdateChecker({
  appVersion,
  status,
  onCheck,
  onInstall,
  onRestart,
}: UpdateCheckerProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Updates</h3>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">Glimt</span>
              <Badge variant="secondary">v{appVersion}</Badge>
              {status.state === 'available' && (
                <Badge variant="default">{status.version} available</Badge>
              )}
              {status.state === 'up-to-date' && <Badge variant="outline">Up to date</Badge>}
              {status.state === 'ready' && <Badge variant="default">Ready to restart</Badge>}
            </div>

            {status.state === 'available' && status.body && (
              <p className="text-sm text-muted-foreground">{status.body}</p>
            )}

            {status.state === 'error' && (
              <p className="text-sm text-destructive">{status.message}</p>
            )}

            {status.state === 'downloading' && (
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(status.progress)}%` }}
                />
              </div>
            )}
          </div>

          <div>
            {(status.state === 'idle' ||
              status.state === 'up-to-date' ||
              status.state === 'error') && (
              <Button size="sm" onClick={onCheck}>
                Check for updates
              </Button>
            )}
            {status.state === 'checking' && (
              <Button size="sm" disabled>
                Checking...
              </Button>
            )}
            {status.state === 'available' && (
              <Button size="sm" onClick={onInstall}>
                Install update
              </Button>
            )}
            {status.state === 'downloading' && (
              <Button size="sm" disabled>
                {Math.round(status.progress)}%
              </Button>
            )}
            {status.state === 'ready' && (
              <Button size="sm" onClick={onRestart}>
                Restart now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
