<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;

class ChannelController extends Controller
{
    protected WhatsAppService $whatsappService;

    public function __construct(WhatsAppService $whatsappService)
    {
        $this->whatsappService = $whatsappService;
    }

    /**
     * Display a listing of channels.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if (!$organization) {
            return response()->json(['error' => 'No organization found'], 404);
        }

        $channels = Channel::where('organization_id', $organization->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($channels);
    }

    /**
     * Store a newly created channel.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if (!$organization) {
            return response()->json(['error' => 'No organization found'], 404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:whatsapp,instagram,telegram',
            'phone_number' => 'nullable|string|max:50',
        ]);

        $channel = Channel::create([
            'organization_id' => $organization->id,
            'name' => $validated['name'],
            'type' => $validated['type'],
            'phone_number' => $validated['phone_number'] ?? null,
            'status' => 'disconnected',
        ]);

        return response()->json($channel, 201);
    }

    /**
     * Display the specified channel.
     */
    public function show(Request $request, Channel $channel)
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if ($channel->organization_id !== $organization->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json($channel);
    }

    /**
     * Update the specified channel.
     */
    public function update(Request $request, Channel $channel)
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if ($channel->organization_id !== $organization->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone_number' => 'sometimes|nullable|string|max:50',
        ]);

        $channel->update($validated);

        return response()->json($channel);
    }

    /**
     * Remove the specified channel.
     */
    public function destroy(Request $request, Channel $channel)
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if ($channel->organization_id !== $organization->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Disconnect if connected
        if ($channel->status === 'connected') {
            $this->whatsappService->disconnect($channel);
        }

        $channel->delete();

        return response()->json(['message' => 'Channel deleted successfully']);
    }

    /**
     * Connect a WhatsApp channel and generate QR code
     */
    public function connect(Request $request, Channel $channel)
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if ($channel->organization_id !== $organization->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($channel->type !== 'whatsapp') {
            return response()->json(['error' => 'Only WhatsApp channels can be connected via QR'], 400);
        }

        try {
            $result = $this->whatsappService->initializeChannel($channel);
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to initialize channel',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Disconnect a channel
     */
    public function disconnect(Request $request, Channel $channel)
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if ($channel->organization_id !== $organization->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        try {
            $this->whatsappService->disconnect($channel);
            return response()->json(['message' => 'Channel disconnected successfully']);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to disconnect channel',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get QR code for a channel
     */
    public function getQR(Request $request, Channel $channel)
    {
        $user = $request->user();
        $organization = $user->organizations()->first();

        if ($channel->organization_id !== $organization->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if (!$channel->qr_code) {
            return response()->json(['error' => 'No QR code available'], 404);
        }

        return response()->json([
            'qr_code' => $channel->qr_code,
            'status' => $channel->status,
        ]);
    }
}
