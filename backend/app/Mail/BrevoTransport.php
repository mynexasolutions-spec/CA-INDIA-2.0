<?php

namespace App\Mail;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;

/**
 * Sends Laravel mail through Brevo's transactional email API (POST /v3/smtp/email), so no SMTP
 * login is needed — only BREVO_API_KEY. Registered as the "brevo" mailer in AppServiceProvider.
 */
class BrevoTransport extends AbstractTransport
{
    private const ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

    public function __construct(private readonly string $apiKey, private readonly int $timeout = 20, private readonly ?string $caBundle = null)
    {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());

        $from = $email->getFrom()[0] ?? null;
        if (! $from) {
            throw new TransportException('Brevo: the message has no sender address.');
        }

        $payload = [
            'sender'  => $this->addr($from),
            'to'      => $this->addrs($email->getTo()),
            'subject' => (string) $email->getSubject(),
        ];
        if ($cc = $this->addrs($email->getCc())) {
            $payload['cc'] = $cc;
        }
        if ($bcc = $this->addrs($email->getBcc())) {
            $payload['bcc'] = $bcc;
        }
        if ($reply = $email->getReplyTo()) {
            $payload['replyTo'] = $this->addr($reply[0]);
        }

        $html = $email->getHtmlBody();
        $text = $email->getTextBody();
        if ($html !== null && $html !== '') {
            $payload['htmlContent'] = (string) $html;
            if ($text !== null && $text !== '') {
                $payload['textContent'] = (string) $text;
            }
        } else {
            $payload['textContent'] = (string) ($text ?? '');
        }

        $attachments = [];
        foreach ($email->getAttachments() as $part) {
            $attachments[] = [
                'name'    => $part->getPreparedHeaders()->getHeaderParameter('Content-Disposition', 'filename') ?: 'attachment',
                'content' => base64_encode($part->getBody()),
            ];
        }
        if ($attachments) {
            $payload['attachment'] = $attachments;
        }

        // Optional CA bundle path (BREVO_CA_BUNDLE) for machines whose PHP has no curl.cainfo, e.g. a
        // Windows dev box. Servers with a normal system CA store leave it empty.
        $verify = ($this->caBundle && is_file($this->caBundle)) ? $this->caBundle : true;

        $response = Http::withHeaders(['api-key' => $this->apiKey, 'accept' => 'application/json'])
            ->withOptions(['verify' => $verify])
            ->timeout($this->timeout)
            ->post(self::ENDPOINT, $payload);

        if ($response->failed()) {
            throw new TransportException(
                'Brevo API error '.$response->status().': '.($response->json('message') ?? $response->body())
            );
        }

        if ($id = $response->json('messageId')) {
            $message->setMessageId(trim((string) $id, '<>'));
        }
    }

    /** @return array{email: string, name?: string} */
    private function addr(Address $a): array
    {
        $out = ['email' => $a->getAddress()];
        if ($a->getName() !== '') {
            $out['name'] = $a->getName();
        }

        return $out;
    }

    /** @param  Address[]  $list */
    private function addrs(array $list): array
    {
        return array_map(fn (Address $a) => $this->addr($a), array_values($list));
    }

    public function __toString(): string
    {
        return 'brevo';
    }
}
