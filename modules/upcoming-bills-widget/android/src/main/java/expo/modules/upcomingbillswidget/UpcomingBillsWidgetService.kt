package expo.modules.upcomingbillswidget

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import android.widget.RemoteViewsService

class UpcomingBillsWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
        UpcomingBillsRowsFactory(applicationContext)
}

private sealed class UpcomingBillsItem {
    data class Band(val isOverdue: Boolean) : UpcomingBillsItem()
    data class Bill(val row: UpcomingBillsRow) : UpcomingBillsItem()
}

private class UpcomingBillsRowsFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
    private var items: List<UpcomingBillsItem> = emptyList()

    override fun onCreate() = Unit

    // Overdue and Upcoming bands only appear when something is late; otherwise the list is plain rows.
    override fun onDataSetChanged() {
        val rows = UpcomingBillsStore.readRows(context).orEmpty()
        val (late, rest) = rows.partition { it.isLate() }
        items = if (late.isEmpty()) {
            rows.map { UpcomingBillsItem.Bill(it) }
        } else {
            buildList {
                add(UpcomingBillsItem.Band(isOverdue = true))
                late.forEach { add(UpcomingBillsItem.Bill(it)) }
                if (rest.isNotEmpty()) {
                    add(UpcomingBillsItem.Band(isOverdue = false))
                    rest.forEach { add(UpcomingBillsItem.Bill(it)) }
                }
            }
        }
    }

    override fun onDestroy() {
        items = emptyList()
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews? = when (val item = items.getOrNull(position)) {
        is UpcomingBillsItem.Band -> bandViews(item.isOverdue)
        is UpcomingBillsItem.Bill -> billViews(item.row)
        null -> null
    }

    private fun bandViews(isOverdue: Boolean): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.upcoming_bills_widget_band)
        views.setTextViewText(
            R.id.upcoming_bills_widget_band,
            context.getString(
                if (isOverdue) R.string.upcoming_bills_widget_band_overdue else R.string.upcoming_bills_widget_band_upcoming,
            ),
        )
        views.setTextColor(
            R.id.upcoming_bills_widget_band,
            context.getColor(
                if (isOverdue) R.color.upcoming_bills_widget_overdue else R.color.upcoming_bills_widget_text_secondary,
            ),
        )
        return views
    }

    private fun billViews(row: UpcomingBillsRow): RemoteViews {
        val isLate = row.isLate()
        val views = RemoteViews(context.packageName, R.layout.upcoming_bills_widget_row)

        val tileBackground: Int
        val glyphColor: Int
        when {
            isLate -> {
                tileBackground = R.drawable.upcoming_bills_widget_tile_negative
                glyphColor = context.getColor(R.color.upcoming_bills_widget_overdue)
            }
            row.isAccent -> {
                tileBackground = R.drawable.upcoming_bills_widget_tile_accent
                glyphColor = context.getColor(R.color.upcoming_bills_widget_accent)
            }
            else -> {
                tileBackground = R.drawable.upcoming_bills_widget_tile_neutral
                glyphColor = context.getColor(R.color.upcoming_bills_widget_text_secondary)
            }
        }
        views.setInt(R.id.upcoming_bills_widget_tile, "setBackgroundResource", tileBackground)
        views.setImageViewResource(R.id.upcoming_bills_widget_tile, iconResource(row.icon))
        views.setInt(R.id.upcoming_bills_widget_tile, "setColorFilter", glyphColor)

        views.setTextViewText(R.id.upcoming_bills_widget_title, row.title)
        views.setTextViewText(R.id.upcoming_bills_widget_meta, row.meta)
        views.setViewVisibility(
            R.id.upcoming_bills_widget_meta,
            if (row.meta.isEmpty()) android.view.View.GONE else android.view.View.VISIBLE,
        )
        views.setTextViewText(R.id.upcoming_bills_widget_amount, row.amount)
        views.setTextViewText(R.id.upcoming_bills_widget_caption, row.caption())
        views.setTextColor(
            R.id.upcoming_bills_widget_caption,
            context.getColor(
                if (isLate) R.color.upcoming_bills_widget_overdue else R.color.upcoming_bills_widget_text_secondary,
            ),
        )

        views.setOnClickFillInIntent(
            R.id.upcoming_bills_widget_row,
            Intent().setData(Uri.parse(row.link)),
        )
        return views
    }

    override fun getLoadingView(): RemoteViews = RemoteViews(context.packageName, R.layout.upcoming_bills_widget_loading)

    override fun getViewTypeCount(): Int = 2

    override fun getItemId(position: Int): Long = when (val item = items.getOrNull(position)) {
        is UpcomingBillsItem.Band -> (if (item.isOverdue) "band-overdue" else "band-upcoming").hashCode().toLong()
        is UpcomingBillsItem.Bill -> item.row.key.hashCode().toLong()
        null -> position.toLong()
    }

    override fun hasStableIds(): Boolean = true

    private fun iconResource(icon: String): Int = when (icon) {
        "home" -> R.drawable.upcoming_bills_widget_ic_home
        "zap" -> R.drawable.upcoming_bills_widget_ic_zap
        "shield" -> R.drawable.upcoming_bills_widget_ic_shield
        "play-circle" -> R.drawable.upcoming_bills_widget_ic_play_circle
        "navigation" -> R.drawable.upcoming_bills_widget_ic_navigation
        "coffee" -> R.drawable.upcoming_bills_widget_ic_coffee
        "heart" -> R.drawable.upcoming_bills_widget_ic_heart
        "film" -> R.drawable.upcoming_bills_widget_ic_film
        "book-open" -> R.drawable.upcoming_bills_widget_ic_book_open
        "pocket" -> R.drawable.upcoming_bills_widget_ic_pocket
        "trending-down" -> R.drawable.upcoming_bills_widget_ic_trending_down
        "credit-card" -> R.drawable.upcoming_bills_widget_ic_credit_card
        else -> R.drawable.upcoming_bills_widget_ic_tag
    }
}
