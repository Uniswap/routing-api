import { Widget } from './model/widget'

export interface WidgetsFactory {
  generateWidgets(): Widget[]
}
