import { animate } from "motion/react"

export class AnimateGradient {
  abortController = new AbortController()

  runningElements: AnimatePath[] = []

  duration = 5

  running = {
    input: false,
  }

  constructor(public element: HTMLElement) {
    this.runningElements = Array.from(element.querySelectorAll("svg path")).map(
      (path_el, index) => {
        return new AnimatePath(
          path_el as SVGPathElement,
          this.abortController.signal,
          index % 2 === 0 ? 1 : -1,
        )
      },
    )
  }

  observeForInput(inputElement: HTMLInputElement) {
    const baseEl = this.element
    const running = this.running

    inputElement.addEventListener(
      "focus",
      () => {
        if (running.input) return
        running.input = true

        const new_value =
          baseEl.dataset.state === "active" ? "inactive" : "active"

        baseEl.setAttribute("data-state", new_value)

        setTimeout(function reset_after_2s() {
          running.input = false
          baseEl.setAttribute("data-state", "inactive")
        }, this.duration * 1000)
      },
      { signal: this.abortController.signal },
    )

    inputElement.addEventListener(
      "blur",
      () => {
        running.input = false
        baseEl.setAttribute("data-state", "inactive")
      },
      { signal: this.abortController.signal },
    )
  }

  play() {
    this.runningElements.map((e) => e.playNonStop())
  }

  stop() {
    this.abortController.abort()
  }
}

export class AnimatePath {
  index = 2

  path_values = [
    "M773 561.386L-0.000550845 561.386L47.4735 463.939L263.171 386.68L117.499 309.422L386.499 267.781L221.499 149.5L317.499 102.104L76.2548 5.04504L773 0.38623L773 561.386Z",
    "M778 561.79L294.202 561.79L0.721739 561.79L199.356 405.812L307.254 321.074L403.409 254.113L108.328 179.048L226.5 102.508L374.516 0.790046L778 0.790046L778 561.79Z",
    "M773 561.159L-0.000489809 561.159L47.4736 463.712L263.171 386.453L34.5629 309.194L386.5 267.554L221.5 149.272L445.072 101.876L290.971 4.81751L773 0.158691L773 561.159Z",
    "M775 561.923L15.4821 561.923L89.3267 442.156L178.924 365.892L298.431 288.634L142.789 231.445L367.123 189.805L195.234 71.523L418.806 24.127L775 0.923461L775 561.923Z",
    "M770 561.634L183.745 561.634L134.621 484.376L291.504 407.118L67.8952 329.859L334.267 288.219L259.203 169.937L401.835 122.541L155.617 25.4824L770 0.634521L770 561.634Z",
    "M776 561.287L-0.00123456 561.287L62.1847 479.692L345.892 402.434L189.274 325.175L427.618 283.535L312.745 165.253L498.361 117.857L234.156 20.7983L776 0.287109L776 561.287Z",
    "M774 561.845L108.934 561.845L201.578 456.789L123.456 379.531L356.789 302.272L198.432 245.083L389.567 203.443L267.891 85.161L512.345 37.765L774 0.845237L774 561.845Z",
    "M772 561.512L234.678 561.512L178.345 468.234L289.123 390.976L145.789 313.717L398.456 272.077L323.234 153.795L456.789 106.399L198.567 9.34023L772 0.512358L772 561.512Z",
    "M779 561.698L-0.00187654 561.698L91.2345 447.853L267.891 370.595L123.567 293.336L412.345 251.696L298.456 133.414L478.912 86.018L156.789 28.9593L779 0.698425L779 561.698Z",
    "M771 561.356L156.789 561.356L245.123 473.912L198.456 396.654L334.789 319.395L189.123 262.206L423.567 220.566L312.789 102.284L534.123 54.888L771 0.356842L771 561.356Z",
  ]

  constructor(
    public pathEl: SVGPathElement,
    public signal: AbortSignal,
    public dir: -1 | 1 = 1,
  ) {}

  randomIndex(last_index: number): number {
    const generateRandomIndex = (): number =>
      Math.floor(Math.random() * this.path_values.length)

    const findValidIndex = (currentIndex: number): number => {
      const newIndex = generateRandomIndex()
      return newIndex === last_index ? findValidIndex(currentIndex) : newIndex
    }

    return findValidIndex(last_index)
  }

  next() {
    const { index, path_values } = this

    const new_index = this.randomIndex(index)
    this.index = new_index

    const transition_duration = Math.floor(Math.random() * 10)

    return {
      index: new_index,
      value: path_values.at(new_index),
      duration: transition_duration,
    }
  }

  doPlay() {
    const next_path = this.next()

    const promise_with_control = animate(
      this.pathEl,
      { d: next_path.value },
      {
        duration: next_path.duration,
      },
    )

    this.signal.addEventListener("abort", () => promise_with_control.stop())

    return promise_with_control
  }

  async playNonStop() {
    return this.doPlay().then(() => this.playNonStop())
  }
}
