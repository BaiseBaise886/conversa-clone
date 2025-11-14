@extends('layouts.app')

@section('content')
<div class="sidebar">
    <h1>🗨️ Conversa</h1>
    
    <nav>
        <a href="{{ route('dashboard') }}" class="active">📊 Dashboard</a>
        <a href="{{ route('contacts.index') }}">👥 Contacts</a>
        <a href="{{ route('channels.index') }}">📱 Channels</a>
        <a href="{{ route('messages.index') }}">💬 Messages</a>
        <a href="{{ route('flows.index') }}">🎨 Flows</a>
    </nav>
    
    <div style="position: absolute; bottom: 20px; width: calc(100% - 40px);">
        <form method="POST" action="{{ route('logout') }}">
            @csrf
            <button type="submit" class="btn btn-danger" style="width: 100%;">Logout</button>
        </form>
    </div>
</div>

<div class="main-content">
    <div class="header">
        <div>
            <h2>Dashboard</h2>
            <p style="color: #7f8c8d; margin-top: 5px;">Welcome, {{ auth()->user()->name }}!</p>
        </div>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div class="card" style="text-align: center;">
            <h3 style="color: #3498db; font-size: 42px;">{{ $stats['contacts'] }}</h3>
            <p style="color: #7f8c8d;">Total Contacts</p>
        </div>
        
        <div class="card" style="text-align: center;">
            <h3 style="color: #2ecc71; font-size: 42px;">{{ $stats['channels'] }}</h3>
            <p style="color: #7f8c8d;">Active Channels</p>
        </div>
        
        <div class="card" style="text-align: center;">
            <h3 style="color: #e74c3c; font-size: 42px;">{{ $stats['messages'] }}</h3>
            <p style="color: #7f8c8d;">Messages Today</p>
        </div>
        
        <div class="card" style="text-align: center;">
            <h3 style="color: #f39c12; font-size: 42px;">{{ $stats['flows'] }}</h3>
            <p style="color: #7f8c8d;">Active Flows</p>
        </div>
    </div>
    
    <div class="card">
        <h3>Recent Contacts</h3>
        
        @if($recentContacts->count() > 0)
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Channel</th>
                        <th>Last Message</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($recentContacts as $contact)
                    <tr>
                        <td>{{ $contact->name ?: 'Unknown' }}</td>
                        <td>{{ $contact->phone }}</td>
                        <td><span class="status-badge">{{ ucfirst($contact->channel_type) }}</span></td>
                        <td>{{ $contact->last_message_at ? $contact->last_message_at->diffForHumans() : 'Never' }}</td>
                        <td>
                            <a href="{{ route('contacts.show', $contact) }}" class="btn" style="padding: 6px 12px; font-size: 12px;">View</a>
                        </td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        @else
            <p style="text-align: center; color: #7f8c8d; padding: 40px 0;">
                No contacts yet. Start by connecting a WhatsApp channel!
            </p>
        @endif
    </div>
    
    <div class="card">
        <h3>Connected Channels</h3>
        
        @if($channels->count() > 0)
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($channels as $channel)
                    <tr>
                        <td>{{ $channel->name }}</td>
                        <td>{{ ucfirst($channel->type) }}</td>
                        <td>{{ $channel->phone_number ?: 'N/A' }}</td>
                        <td>
                            <span class="status-badge {{ $channel->status === 'connected' ? 'connected' : 'disconnected' }}">
                                {{ ucfirst($channel->status) }}
                            </span>
                        </td>
                        <td>
                            <a href="{{ route('channels.show', $channel) }}" class="btn" style="padding: 6px 12px; font-size: 12px;">Manage</a>
                        </td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        @else
            <p style="text-align: center; color: #7f8c8d; padding: 40px 0;">
                No channels connected. <a href="{{ route('channels.create') }}">Connect your first channel</a>
            </p>
        @endif
    </div>
</div>
@endsection
