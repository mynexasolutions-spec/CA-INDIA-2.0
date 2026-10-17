<?php

namespace App\Providers;

use App\Mail\BrevoTransport;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // MAIL_MAILER=brevo sends through Brevo's HTTP API (needs only BREVO_API_KEY, no SMTP login).
        Mail::extend('brevo', fn (array $config) => new BrevoTransport((string) ($config['key'] ?? ''), 20, $config['ca_bundle'] ?? null));
    }
}
