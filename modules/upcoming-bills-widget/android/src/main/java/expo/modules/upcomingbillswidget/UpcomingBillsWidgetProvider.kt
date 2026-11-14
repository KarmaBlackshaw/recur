package expo.modules.upcomingbillswidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews

class UpcomingBillsWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        update(context, appWidgetManager, appWidgetIds)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == UpcomingBillsWidgetContract.ACTION_ROLLOVER) {
            refreshAll(context)
        }
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        alarmManager(context)?.cancel(rolloverIntent(context))
    }

    companion object {
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, UpcomingBillsWidgetProvider::class.java))
            if (ids.isNotEmpty()) {
                update(context, manager, ids)
            }
        }

        private fun update(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val rows = UpcomingBillsStore.readRows(context)
            val lateCount = rows?.count { it.isLate() } ?: 0
            for (id in ids) {
                manager.updateAppWidget(id, buildViews(context, id, rows == null, lateCount))
            }
            manager.notifyAppWidgetViewDataChanged(ids, R.id.upcoming_bills_widget_list)
            scheduleRollover(context)
        }

        private fun buildViews(context: Context, widgetId: Int, isUnloaded: Boolean, lateCount: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.upcoming_bills_widget)

            val serviceIntent = Intent(context, UpcomingBillsWidgetService::class.java)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            serviceIntent.data = Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME))
            views.setRemoteAdapter(R.id.upcoming_bills_widget_list, serviceIntent)
            views.setEmptyView(R.id.upcoming_bills_widget_list, R.id.upcoming_bills_widget_empty)
            views.setTextViewText(
                R.id.upcoming_bills_widget_empty_title,
                context.getString(
                    if (isUnloaded) R.string.upcoming_bills_widget_empty_unloaded_title
                    else R.string.upcoming_bills_widget_empty_none_title,
                ),
            )
            views.setTextViewText(
                R.id.upcoming_bills_widget_empty_text,
                context.getString(
                    if (isUnloaded) R.string.upcoming_bills_widget_empty_unloaded_text
                    else R.string.upcoming_bills_widget_empty_none_text,
                ),
            )
            views.setOnClickPendingIntent(R.id.upcoming_bills_widget_empty, homeIntent(context))

            if (lateCount > 0) {
                views.setTextViewText(R.id.upcoming_bills_widget_late, "$lateCount late")
                views.setViewVisibility(R.id.upcoming_bills_widget_late, android.view.View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.upcoming_bills_widget_late, android.view.View.GONE)
            }

            views.setOnClickPendingIntent(R.id.upcoming_bills_widget_header, homeIntent(context))
            views.setPendingIntentTemplate(R.id.upcoming_bills_widget_list, rowTemplate(context))
            return views
        }

        private fun viewIntent(context: Context): Intent =
            Intent(Intent.ACTION_VIEW)
                .setPackage(context.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

        private fun homeIntent(context: Context): PendingIntent {
            val intent = viewIntent(context).setData(Uri.parse(UpcomingBillsWidgetContract.HOME_LINK))
            return PendingIntent.getActivity(
                context,
                1,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        }

        // Rows supply the deep link as fill-in data, so the template has to be mutable on S+.
        private fun rowTemplate(context: Context): PendingIntent {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            return PendingIntent.getActivity(context, 0, viewIntent(context), flags)
        }

        private fun alarmManager(context: Context): AlarmManager? =
            context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

        private fun rolloverIntent(context: Context): PendingIntent {
            val intent = Intent(context, UpcomingBillsWidgetProvider::class.java)
                .setAction(UpcomingBillsWidgetContract.ACTION_ROLLOVER)
            return PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        }

        // Inexact alarm just after local midnight so captions and the late count roll over without the app.
        private fun scheduleRollover(context: Context) {
            val triggerAt = UpcomingBillsDates.nextMidnightMillis() + 60_000L
            alarmManager(context)?.set(AlarmManager.RTC, triggerAt, rolloverIntent(context))
        }
    }
}
