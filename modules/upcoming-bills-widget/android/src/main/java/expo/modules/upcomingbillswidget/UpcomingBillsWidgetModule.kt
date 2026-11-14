package expo.modules.upcomingbillswidget

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UpcomingBillsWidgetModule : Module() {
    override fun definition() = ModuleDefinition {
        Name(UpcomingBillsWidgetContract.MODULE_NAME)

        AsyncFunction("setSnapshot") { json: String ->
            val context = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()
            UpcomingBillsStore.write(context, json)
            UpcomingBillsWidgetProvider.refreshAll(context)
        }
    }
}
