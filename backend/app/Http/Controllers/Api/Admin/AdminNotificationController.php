<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\NotificationItem;
use Illuminate\Http\Request;

class AdminNotificationController extends Controller
{
    public function index(Request $request)
    {
        $uid = $request->user()->id;

        $items = NotificationItem::where('user_id', $uid)
            ->orderByDesc('created_at')
            ->take(20)
            ->get();

        $unread = NotificationItem::where('user_id', $uid)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'notifications' => $items,
            'unread'        => $unread,
        ]);
    }

    public function markRead(Request $request, int $id)
    {
        NotificationItem::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function markAllRead(Request $request)
    {
        NotificationItem::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
