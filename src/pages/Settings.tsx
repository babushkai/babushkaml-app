import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon,
  Server,
  Bell,
  Shield,
  Palette,
  Save,
  RotateCcw,
  ExternalLink,
  Check,
  Sun,
  Moon,
  Monitor,
  Cpu,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ComputeSettings } from '@/components/settings/ComputeSettings'
import { cn } from '@/lib/utils'
import type { AppState } from '@/types'
import type { Theme } from '@/hooks/useTheme'

interface SettingsProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
  theme: Theme
  setTheme: (theme: Theme) => void
}

type SettingsTab = 'general' | 'connections' | 'notifications' | 'security' | 'appearance' | 'compute'

interface SettingsSectionProps {
  title: string
  description: string
  children: React.ReactNode
}

function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-[var(--text-primary)]">{title}</h3>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      {children}
    </div>
  )
}

interface ToggleSwitchProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  label: string
  description?: string
}

function ToggleSwitch({ enabled, onChange, label, description }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        {description && (
          <p className="text-xs text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors',
          enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform',
            enabled && 'translate-x-5'
          )}
        />
      </button>
    </div>
  )
}

export function Settings({ state, addToast, theme, setTheme }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [isSaving, setIsSaving] = useState(false)

  // Settings state
  const [settings, setSettings] = useState({
    // General
    projectName: 'MLOps Console',
    defaultModel: '',
    autoRefresh: true,
    refreshInterval: 5,

    // Connections
    apiUrl: 'http://localhost:8000',
    mlflowUrl: 'http://localhost:5000',
    prometheusUrl: 'http://localhost:9090',
    grafanaUrl: 'http://localhost:3000',

    // Notifications
    emailNotifications: true,
    slackNotifications: false,
    alertOnDrift: true,
    alertOnError: true,
    alertOnTrainingComplete: true,

    // Security
    requireAuth: false,
    sessionTimeout: 30,
    apiKeyEnabled: false,

    // Appearance
    compactMode: false,
    showShortcuts: true,
  })

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'connections', label: 'Connections', icon: Server },
    { id: 'compute', label: 'Compute', icon: Cpu },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ]

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Simulate saving
      await new Promise(resolve => setTimeout(resolve, 1000))
      addToast('Settings saved successfully', 'success')
    } catch {
      addToast('Failed to save settings', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    addToast('Settings reset to defaults', 'info')
  }

  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 lg:grid-cols-4 gap-6"
    >
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <Card>
          <CardContent className="p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] transition-colors text-left',
                      isActive
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <div className="lg:col-span-3 space-y-6">
        <Card>
          <CardHeader
            title={tabs.find(t => t.id === activeTab)?.label || ''}
            action={
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
                <Button size="sm" variant="primary" onClick={handleSave} loading={isSaving}>
                  <Save className="w-4 h-4" />
                  Save
                </Button>
              </div>
            }
          />
          <CardContent className="space-y-8">
            {activeTab === 'general' && (
              <>
                <SettingsSection
                  title="Project Information"
                  description="Basic project settings and identifiers"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Project Name"
                      value={settings.projectName}
                      onChange={(e) => updateSetting('projectName', e.target.value)}
                    />
                    <Input
                      label="Default Model ID"
                      value={settings.defaultModel}
                      onChange={(e) => updateSetting('defaultModel', e.target.value)}
                      placeholder="Leave empty for latest"
                    />
                  </div>
                </SettingsSection>

                <SettingsSection
                  title="Auto Refresh"
                  description="Automatically refresh data from the backend"
                >
                  <ToggleSwitch
                    enabled={settings.autoRefresh}
                    onChange={(v) => updateSetting('autoRefresh', v)}
                    label="Enable auto refresh"
                    description="Automatically fetch new data periodically"
                  />
                  {settings.autoRefresh && (
                    <Input
                      label="Refresh Interval (seconds)"
                      type="number"
                      value={String(settings.refreshInterval)}
                      onChange={(e) => updateSetting('refreshInterval', parseInt(e.target.value) || 5)}
                    />
                  )}
                </SettingsSection>
              </>
            )}

            {activeTab === 'connections' && (
              <>
                <SettingsSection
                  title="Service Endpoints"
                  description="Configure URLs for backend services"
                >
                  <div className="space-y-4">
                    {[
                      { key: 'apiUrl' as const, label: 'API Server', placeholder: 'http://localhost:8000' },
                      { key: 'mlflowUrl' as const, label: 'MLflow Server', placeholder: 'http://localhost:5000' },
                      { key: 'prometheusUrl' as const, label: 'Prometheus', placeholder: 'http://localhost:9090' },
                      { key: 'grafanaUrl' as const, label: 'Grafana', placeholder: 'http://localhost:3000' },
                    ].map((service) => (
                      <div key={service.key} className="flex items-end gap-2">
                        <div className="flex-1">
                          <Input
                            label={service.label}
                            value={settings[service.key]}
                            onChange={(e) => updateSetting(service.key, e.target.value)}
                            placeholder={service.placeholder}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => window.open(settings[service.key], '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </SettingsSection>

                <SettingsSection
                  title="Connection Status"
                  description="Current connection status to services"
                >
                  <div className="grid grid-cols-2 gap-4">
                    {['API', 'MLflow', 'Prometheus', 'Grafana'].map((service) => (
                      <div
                        key={service}
                        className="flex items-center justify-between p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]"
                      >
                        <span className="text-sm text-[var(--text-primary)]">{service}</span>
                        <Badge variant="default">Offline</Badge>
                      </div>
                    ))}
                  </div>
                </SettingsSection>
              </>
            )}

            {activeTab === 'compute' && (
              <ComputeSettings models={state.models} addToast={addToast} />
            )}

            {activeTab === 'notifications' && (
              <>
                <SettingsSection
                  title="Notification Channels"
                  description="Configure how you receive alerts"
                >
                  <ToggleSwitch
                    enabled={settings.emailNotifications}
                    onChange={(v) => updateSetting('emailNotifications', v)}
                    label="Email Notifications"
                    description="Receive alerts via email"
                  />
                  <ToggleSwitch
                    enabled={settings.slackNotifications}
                    onChange={(v) => updateSetting('slackNotifications', v)}
                    label="Slack Notifications"
                    description="Send alerts to Slack channel"
                  />
                </SettingsSection>

                <SettingsSection
                  title="Alert Types"
                  description="Choose which events trigger notifications"
                >
                  <ToggleSwitch
                    enabled={settings.alertOnDrift}
                    onChange={(v) => updateSetting('alertOnDrift', v)}
                    label="Data Drift Alerts"
                    description="Notify when data drift is detected"
                  />
                  <ToggleSwitch
                    enabled={settings.alertOnError}
                    onChange={(v) => updateSetting('alertOnError', v)}
                    label="Error Alerts"
                    description="Notify on prediction errors or system failures"
                  />
                  <ToggleSwitch
                    enabled={settings.alertOnTrainingComplete}
                    onChange={(v) => updateSetting('alertOnTrainingComplete', v)}
                    label="Training Complete"
                    description="Notify when model training finishes"
                  />
                </SettingsSection>
              </>
            )}

            {activeTab === 'security' && (
              <>
                <SettingsSection
                  title="Authentication"
                  description="Control access to the platform"
                >
                  <ToggleSwitch
                    enabled={settings.requireAuth}
                    onChange={(v) => updateSetting('requireAuth', v)}
                    label="Require Authentication"
                    description="Users must log in to access the platform"
                  />
                  {settings.requireAuth && (
                    <Input
                      label="Session Timeout (minutes)"
                      type="number"
                      value={String(settings.sessionTimeout)}
                      onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value) || 30)}
                    />
                  )}
                </SettingsSection>

                <SettingsSection
                  title="API Security"
                  description="Secure API access"
                >
                  <ToggleSwitch
                    enabled={settings.apiKeyEnabled}
                    onChange={(v) => updateSetting('apiKeyEnabled', v)}
                    label="Require API Key"
                    description="Require API key for external requests"
                  />
                  {settings.apiKeyEnabled && (
                    <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[var(--text-primary)]">API Key</p>
                          <p className="text-xs font-mono text-[var(--text-muted)] mt-1">
                            mlops_••••••••••••••••
                          </p>
                        </div>
                        <Button size="sm" onClick={() => addToast('API key regenerated', 'success')}>
                          Regenerate
                        </Button>
                      </div>
                    </div>
                  )}
                </SettingsSection>
              </>
            )}

            {activeTab === 'appearance' && (
              <>
                <SettingsSection
                  title="Theme"
                  description="Choose your preferred color scheme"
                >
                  <div className="grid grid-cols-3 gap-4">
                    {/* Dark Theme */}
                    <button
                      onClick={() => {
                        setTheme('dark')
                        addToast('Dark theme applied', 'success')
                      }}
                      className={cn(
                        'relative p-4 rounded-[var(--radius-lg)] border-2 transition-all overflow-hidden',
                        theme === 'dark'
                          ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20'
                          : 'border-[var(--border-primary)] hover:border-[var(--border-accent)]'
                      )}
                    >
                      {/* Theme preview */}
                      <div className="mb-3 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-secondary)]">
                        <div className="h-20 bg-[#0a0b0f] p-2">
                          <div className="flex gap-1 mb-2">
                            <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                            <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                            <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                          </div>
                          <div className="flex gap-2 h-full">
                            <div className="w-6 bg-[#12141a] rounded" />
                            <div className="flex-1 bg-[#12141a] rounded p-1">
                              <div className="h-1.5 w-3/4 bg-[#00d4ff]/30 rounded mb-1" />
                              <div className="h-1 w-1/2 bg-[#1a1d26] rounded" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Moon className="w-4 h-4" />
                        <span className="text-sm font-medium">Dark</span>
                        {theme === 'dark' && (
                          <Check className="w-4 h-4 text-[var(--accent-primary)]" />
                        )}
                      </div>
                    </button>

                    {/* Light Theme */}
                    <button
                      onClick={() => {
                        setTheme('light')
                        addToast('Light theme applied', 'success')
                      }}
                      className={cn(
                        'relative p-4 rounded-[var(--radius-lg)] border-2 transition-all overflow-hidden',
                        theme === 'light'
                          ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20'
                          : 'border-[var(--border-primary)] hover:border-[var(--border-accent)]'
                      )}
                    >
                      {/* Theme preview */}
                      <div className="mb-3 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-secondary)]">
                        <div className="h-20 bg-[#fafbfc] p-2">
                          <div className="flex gap-1 mb-2">
                            <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                            <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                            <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                          </div>
                          <div className="flex gap-2 h-full">
                            <div className="w-6 bg-[#ffffff] rounded shadow-sm" />
                            <div className="flex-1 bg-[#ffffff] rounded shadow-sm p-1">
                              <div className="h-1.5 w-3/4 bg-[#0891b2]/30 rounded mb-1" />
                              <div className="h-1 w-1/2 bg-[#f1f5f9] rounded" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Sun className="w-4 h-4" />
                        <span className="text-sm font-medium">Light</span>
                        {theme === 'light' && (
                          <Check className="w-4 h-4 text-[var(--accent-primary)]" />
                        )}
                      </div>
                    </button>

                    {/* System Theme */}
                    <button
                      onClick={() => {
                        setTheme('system')
                        addToast('System theme applied', 'success')
                      }}
                      className={cn(
                        'relative p-4 rounded-[var(--radius-lg)] border-2 transition-all overflow-hidden',
                        theme === 'system'
                          ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20'
                          : 'border-[var(--border-primary)] hover:border-[var(--border-accent)]'
                      )}
                    >
                      {/* Theme preview - split */}
                      <div className="mb-3 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-secondary)]">
                        <div className="h-20 flex">
                          <div className="w-1/2 bg-[#0a0b0f] p-1">
                            <div className="w-full h-full bg-[#12141a] rounded">
                              <div className="h-1 w-3/4 bg-[#00d4ff]/30 rounded m-1" />
                            </div>
                          </div>
                          <div className="w-1/2 bg-[#fafbfc] p-1">
                            <div className="w-full h-full bg-[#ffffff] rounded shadow-sm">
                              <div className="h-1 w-3/4 bg-[#0891b2]/30 rounded m-1" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Monitor className="w-4 h-4" />
                        <span className="text-sm font-medium">System</span>
                        {theme === 'system' && (
                          <Check className="w-4 h-4 text-[var(--accent-primary)]" />
                        )}
                      </div>
                    </button>
                  </div>
                </SettingsSection>

                <SettingsSection
                  title="Display Options"
                  description="Customize the interface"
                >
                  <ToggleSwitch
                    enabled={settings.compactMode}
                    onChange={(v) => updateSetting('compactMode', v)}
                    label="Compact Mode"
                    description="Reduce spacing and padding"
                  />
                  <ToggleSwitch
                    enabled={settings.showShortcuts}
                    onChange={(v) => updateSetting('showShortcuts', v)}
                    label="Show Keyboard Shortcuts"
                    description="Display shortcut hints in the sidebar"
                  />
                </SettingsSection>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

