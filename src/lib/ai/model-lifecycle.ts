export type ModelState = 'idle' | 'loading' | 'ready' | 'error'

export interface ModelSnapshot {
  state: ModelState
  progress: number
  modelId: string
  error?: string
}

export class ModelLifecycle {
  private _state: ModelState = 'idle'
  private _progress = 0
  private _modelId: string
  private _error?: string
  private _listeners = new Set<() => void>()
  private _snapshot: ModelSnapshot | null = null

  constructor(defaultModelId: string) {
    this._modelId = defaultModelId
  }

  subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  getSnapshot = (): ModelSnapshot => {
    if (!this._snapshot) {
      this._snapshot = {
        state: this._state,
        progress: this._progress,
        modelId: this._modelId,
        error: this._error,
      }
    }
    return this._snapshot
  }

  startLoading(modelId: string): void {
    this._state = 'loading'
    this._progress = 0
    this._modelId = modelId
    this._error = undefined
    this._notify()
  }

  setProgress(progress: number): void {
    this._progress = progress
    this._notify()
  }

  setReady(): void {
    this._state = 'ready'
    this._progress = 100
    this._error = undefined
    this._notify()
  }

  setError(error: string): void {
    this._state = 'error'
    this._error = error
    this._notify()
  }

  private _notify(): void {
    this._snapshot = null
    for (const listener of this._listeners) {
      listener()
    }
  }
}
