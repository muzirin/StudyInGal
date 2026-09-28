import { useEffect } from 'react'
import { api } from '../api'
import { useAppStore } from '../state/appStore'

export function ProactiveCompanion() {
  const settings = useAppStore((state) => state.settings)
  const toast = useAppStore((state) => state.toast)

  useEffect(() => {
    if (!settings?.companion.proactive) return
    let cancelled = false

    const run = async (): Promise<void> => {
      try {
        const [characters, papers, textbooks, saves, events] = await Promise.all([
          api.characters.list(),
          api.library.snapshot('paper').catch(() => null),
          api.library.snapshot('textbook').catch(() => null),
          api.archive.list().catch(() => []),
          api.schedule.list().catch(() => [])
        ])
        const character =
          characters.find((item) => item.id === settings.companion.activeCharacterId) ??
          characters.find((item) => item.isCompanion) ??
          characters[0]
        if (!character) return

        const pending = events.filter((event) => !event.done && event.start > Date.now() - 3600_000).length
        const response = await api.ai.chat({
          capability: 'chat',
          messages: [
            { role: 'system', content: character.systemPrompt },
            {
              role: 'user',
              content: `${settings.companion.proactivePrompt}\n（论文 ${papers?.nodes.length ?? 0} 篇，教材 ${
                textbooks?.nodes.length ?? 0
              } 本，Gal 存档 ${saves.length} 个，未完成待办 ${pending} 项。请用一两句话主动和我说。）`
            }
          ]
        })
        if (!cancelled) toast('info', `${character.name}：${response.content}`)
      } catch {
        /* 主动搭话失败时静默，避免打扰 */
      }
    }

    const minutes = Math.max(5, settings.companion.proactiveIntervalMinutes)
    const first = window.setTimeout(() => void run(), 60_000)
    const timer = window.setInterval(() => void run(), minutes * 60_000)
    return () => {
      cancelled = true
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [
    settings?.companion.proactive,
    settings?.companion.proactiveIntervalMinutes,
    settings?.companion.activeCharacterId,
    settings?.companion.proactivePrompt,
    toast
  ])

  return null
}
