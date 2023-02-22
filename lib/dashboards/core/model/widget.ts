// Non-exhaustive list of Widget types, update list as we deem necessary
export type WidgetType = 'text' | 'metric'

export type Widget = {
  type: WidgetType
  width: number
  height: number
  properties: any // TODO: Either find an SDK that already defines models for the widgets, or define them ourselves
}
