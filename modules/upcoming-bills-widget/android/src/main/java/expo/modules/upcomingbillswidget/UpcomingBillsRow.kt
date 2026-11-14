package expo.modules.upcomingbillswidget

import android.content.Context
import org.json.JSONException
import org.json.JSONObject

data class UpcomingBillsRow(
    val key: String,
    val title: String,
    val meta: String,
    val amount: String,
    val paid: String?,
    val icon: String,
    val due: String,
    val isAccent: Boolean,
    val link: String,
) {
    fun daysUntilDue(): Int = UpcomingBillsDates.daysUntil(due)

    fun isLate(): Boolean = daysUntilDue() < 0

    // A part-paid bill reads "₱X paid · in 4 days", like the app's rows.
    fun caption(): String {
        val dateText = UpcomingBillsDates.dueText(due)
        return if (paid != null) "$paid · $dateText" else dateText
    }
}

object UpcomingBillsStore {
    fun write(context: Context, json: String) {
        context.getSharedPreferences(UpcomingBillsWidgetContract.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(UpcomingBillsWidgetContract.PREFS_KEY_SNAPSHOT, json)
            .apply()
    }

    // Null when the app has never published a snapshot (or it can't be read).
    fun readRows(context: Context): List<UpcomingBillsRow>? {
        val json = context.getSharedPreferences(UpcomingBillsWidgetContract.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(UpcomingBillsWidgetContract.PREFS_KEY_SNAPSHOT, null)
            ?: return null
        return try {
            val rows = JSONObject(json).getJSONArray("rows")
            List(rows.length()) { index ->
                val row = rows.getJSONObject(index)
                UpcomingBillsRow(
                    key = row.getString("key"),
                    title = row.getString("title"),
                    meta = row.optString("meta", ""),
                    amount = row.getString("amount"),
                    paid = if (row.isNull("paid")) null else row.getString("paid"),
                    icon = row.getString("icon"),
                    due = row.getString("due"),
                    isAccent = row.optString("tone") == "accent",
                    link = row.getString("link"),
                )
            }
        } catch (_: JSONException) {
            null
        }
    }
}
