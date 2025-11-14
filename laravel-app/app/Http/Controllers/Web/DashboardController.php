<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\Contact;
use App\Models\Flow;
use App\Models\Message;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if (!$organization) {
            return redirect()->route('logout');
        }

        // Get statistics
        $stats = [
            'contacts' => Contact::where('organization_id', $organization->id)->count(),
            'channels' => Channel::where('organization_id', $organization->id)
                ->where('status', 'connected')
                ->count(),
            'messages' => Message::whereHas('contact', function ($query) use ($organization) {
                $query->where('organization_id', $organization->id);
            })
                ->whereDate('created_at', today())
                ->count(),
            'flows' => Flow::where('organization_id', $organization->id)
                ->where('is_active', true)
                ->count(),
        ];

        // Get recent contacts
        $recentContacts = Contact::where('organization_id', $organization->id)
            ->orderBy('last_message_at', 'desc')
            ->limit(10)
            ->get();

        // Get channels
        $channels = Channel::where('organization_id', $organization->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return view('dashboard.index', compact('stats', 'recentContacts', 'channels'));
    }
}
