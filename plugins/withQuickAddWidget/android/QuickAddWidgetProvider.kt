import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class QuickAddWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    val views = RemoteViews(context.packageName, R.layout.quick_add_widget)
    BUTTONS.forEachIndexed { i, (viewId, action) ->
      views.setOnClickPendingIntent(viewId, openAction(context, action, i))
    }
    appWidgetManager.updateAppWidget(appWidgetIds, views)
  }

  private fun openAction(context: Context, action: String, requestCode: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(URL_PREFIX + action), context, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }

  private companion object {
    const val URL_PREFIX = "recur://quick-add/" // must match QUICK_ADD_URL_PREFIX in constants/quickActions.ts
    val BUTTONS = listOf(
      R.id.quick_add_widget_expense to "expense",
      R.id.quick_add_widget_income to "income",
      R.id.quick_add_widget_transfer to "transfer",
      R.id.quick_add_widget_loan to "loan",
    )
  }
}
