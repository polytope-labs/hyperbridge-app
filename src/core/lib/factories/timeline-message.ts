import { safeStr } from "@hyperbridge-fe/shared"
import { isEmpty } from "lodash-es"

interface TimelineMessageEntry {
  type: string
  message: string
  predicate: () => boolean
}

const DELIMITER = "$__$"

export class TimelineMessageBuilder {
  private messages: TimelineMessageEntry[] = []
  private title = "No Title"

  constructor(title: string) {
    this.title = title
  }

  caption(mesage: string, predicate: boolean | (() => boolean) = () => true) {
    this.messages.push({
      type: "caption",
      message: mesage,
      predicate: typeof predicate === "function" ? predicate : () => predicate,
    })

    return this
  }

  get read_title() {
    return this.title
  }

  get read_caption() {
    return this.messages.find((e) => e.predicate() === true)?.message ?? null
  }

  toString() {
    return `TimelineMessageBuilder(${[this.read_title, this.read_caption].join(DELIMITER)})`
  }

  static isValid(message: string) {
    return safeStr(message).includes(DELIMITER)
  }

  /**
   * Parses a message to a tuple of title and caption message
   * @param message
   * @returns
   */
  static toTuple(message: string): [string, string | null] {
    const text = safeStr(message.match(/TimelineMessageBuilder\((.*)\)$/)?.[1])
    const [title, caption] = text
      .split(DELIMITER)
      .map((e) => (isEmpty(e) ? null : e))

    return [title ?? "", caption ?? null]
  }

  static make(message: string) {
    return new TimelineMessageBuilder(message)
  }
}
