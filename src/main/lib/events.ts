import { EventEmitter } from 'node:events'
import type { StudyEvent } from '@shared/channels'

export const bus = new EventEmitter()
bus.setMaxListeners(50)

export function emitEvent(event: StudyEvent): void {
  bus.emit('event', event)
}
