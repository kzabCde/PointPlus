import type { MissionMutationState } from './create-actions'

// Client-safe initial state. Keep values outside 'use server' modules.
export const idleMissionState: MissionMutationState = { status: 'idle', message: '' }
