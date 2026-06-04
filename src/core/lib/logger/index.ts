import { captureException, captureMessage } from "@sentry/react"
import { type ConsolaReporter, createConsola, LogLevels } from "consola"
import { APP_LOG_LEVEL, isDevelopment } from "@/config/constants"

export const rootLogger = createConsola({
  level: LogLevels[APP_LOG_LEVEL],
  formatOptions: {
    columns: 80,
    colors: true,
    compact: true,
    date: false,
  },
})

export const silentLogger = createConsola({
  level: LogLevels.silent,
})

export const debugLogger = rootLogger.withTag("$$$$$$")

// Create a reporter to forward error logs to Sentry
const sentryReporter: ConsolaReporter = {
  log(logObj) {
    // Only send error and fatal levels to Sentry
    if (logObj.level >= LogLevels.error) {
      const { message = "No message", args, ...extra } = logObj

      // If the first arg is an Error object, use it as the exception
      const errorObj = args.find((arg) => arg instanceof Error)

      if (errorObj) {
        captureException(errorObj, {
          level: logObj.level >= LogLevels.fatal ? "fatal" : "error",
          extra: {
            ...extra,
            args: args.filter((arg) => arg !== errorObj),
            consoleMessage: message,
          },
        })
      } else {
        // Otherwise capture as a message with the args as extra data
        captureMessage(message, {
          level: logObj.level >= LogLevels.fatal ? "fatal" : "error",
          extra: { ...extra, args },
        })
      }
    }

    // Return true to continue to the next reporter
    return true
  },
}

// Only add Sentry reporter in non-development environments
// or you can remove this condition if you want Sentry reporting in development too
if (!isDevelopment) {
  rootLogger.addReporter(sentryReporter)
}
