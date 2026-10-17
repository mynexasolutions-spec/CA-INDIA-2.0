<?php

namespace Tests\Feature;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\DocumentLineItem;
use App\Models\User;
use App\Services\Billing\AdminBillingLockService;
use App\Services\Billing\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminBilling3C1QuotationAndChallanTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private ClientProfile $client;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'name' => 'Admin User']);
        Sanctum::actingAs($this->admin);

        $clientUser = User::factory()->create(['role' => 'client', 'is_active' => true, 'name' => 'Test Legal Name']);
        $this->client = ClientProfile::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-001',
            'business_name' => 'Acme Corporation',
            'client_name' => 'Test Legal Name',
            'has_gst' => true,
            'dealer_type' => 'regular',
            'gstin' => '27ABCDE1234F1Z5',
            'pan' => 'ABCDE1234F',
            'constitution_type' => 'Private Limited Company',
            'state' => 'Maharashtra',
            'state_code' => '27',
            'city' => 'Mumbai',
            'address_line_1' => '100 Marine Lines',
            'pincode' => '400020',
        ]);

        $this->customer = Customer::create([
            'client_profile_id' => $this->client->id,
            'name' => 'Alpha Client',
            'state' => 'Maharashtra',
            'state_code' => '27',
            'is_active' => true,
        ]);
    }

    public function test_admin_billing_quotation_and_delivery_challan_endpoints_allowed_and_return_200(): void
    {
        // 1. Create Quotation
        $quotation = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $this->customer->id,
            'type' => 'quotation',
            'number' => 'QT-001',
            'document_date' => '2026-05-01',
            'due_date' => '2026-05-15',
            'status' => 'issued',
            'taxable_amount' => 5000,
            'grand_total' => 5900,
        ]);

        // 2. Create Delivery Challan
        $dc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $this->customer->id,
            'type' => 'delivery_challan',
            'number' => 'DC-001',
            'document_date' => '2026-05-02',
            'status' => 'issued',
            'taxable_amount' => 2000,
            'grand_total' => 2360,
        ]);

        // 3. Admin list for quotation
        $resQuo = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/quotation");
        $resQuo->assertStatus(200);
        $resQuo->assertJsonStructure([
            'documents' => [
                'data' => [
                    '*' => [
                        'id',
                        'number',
                        'status',
                        'converted_document_id',
                        'converted_invoice_number',
                        'converted_document',
                    ],
                ],
            ],
            'cards',
        ]);
        $this->assertEquals(1, $resQuo->json('cards.total'));
        $this->assertEquals('QT-001', $resQuo->json('documents.data.0.number'));

        // 4. Admin list for delivery challan
        $resDc = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/delivery_challan");
        $resDc->assertStatus(200);
        $resDc->assertJsonStructure([
            'documents' => ['data'],
            'cards',
        ]);
        $this->assertEquals(1, $resDc->json('cards.total'));
        $this->assertEquals('DC-001', $resDc->json('documents.data.0.number'));
    }

    public function test_delivery_challan_show_returns_transportation_details_and_never_locked(): void
    {
        $dc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $this->customer->id,
            'type' => 'delivery_challan',
            'number' => 'DC-002',
            'document_date' => '2026-05-05',
            'status' => 'issued',
            'taxable_amount' => 1500,
            'grand_total' => 1770,
            'reason_for_transportation' => 'job_work',
            'reason_for_transportation_other' => null,
            'vehicle_no' => 'MH-01-AB-1234',
            'transporter_name' => 'Fast Logistics',
            'eway_bill_no' => 'EWB-9988776655',
            'receiver_name' => 'Ramesh Sharma',
            'receiver_signature_datetime' => '2026-05-05 14:30:00',
        ]);

        $res = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/delivery_challan/{$dc->id}");
        $res->assertStatus(200);

        $doc = $res->json('document');
        $this->assertEquals('job_work', $doc['reason_for_transportation']);
        $this->assertEquals('MH-01-AB-1234', $doc['vehicle_no']);
        $this->assertEquals('Fast Logistics', $doc['transporter_name']);
        $this->assertEquals('EWB-9988776655', $doc['eway_bill_no']);
        $this->assertEquals('Ramesh Sharma', $doc['receiver_name']);
        $this->assertNotNull($doc['receiver_signature_datetime']);

        $flags = $res->json('flags');
        $this->assertTrue($flags['can_cancel']);
        $this->assertTrue($flags['can_edit_creation_date']);
        $this->assertTrue($flags['can_delete']);
        $this->assertTrue($flags['can_edit']);
        $this->assertEquals('-', $res->json('gst.status'));
    }

    public function test_lock_service_returns_never_locked_for_quotation_and_delivery_challan(): void
    {
        $quoLock = AdminBillingLockService::check($this->client, now(), 'quotation');
        $this->assertFalse($quoLock['is_locked']);
        $this->assertEquals('-', $quoLock['gst_status']);

        $dcLock = AdminBillingLockService::check($this->client, now(), 'delivery_challan');
        $this->assertFalse($dcLock['is_locked']);
        $this->assertEquals('-', $dcLock['gst_status']);
    }

    public function test_converted_quotation_flags_and_action_restrictions(): void
    {
        $quotation = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $this->customer->id,
            'type' => 'quotation',
            'number' => 'QT-CONV-01',
            'document_date' => '2026-05-10',
            'due_date' => '2026-05-25',
            'status' => 'cancelled',
            'taxable_amount' => 4000,
            'grand_total' => 4720,
        ]);

        $invoice = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $this->customer->id,
            'type' => 'tax_invoice',
            'number' => 'INV-CONV-01',
            'document_date' => '2026-05-12',
            'status' => 'issued',
            'taxable_amount' => 4000,
            'grand_total' => 4720,
        ]);

        $quotation->update([
            'converted_document_id' => $invoice->id,
            'cancellation_reason' => 'Converted to Invoice INV-CONV-01',
        ]);

        // 1. Show response flags
        $resShow = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/quotation/{$quotation->id}");
        $resShow->assertStatus(200);

        $flags = $resShow->json('flags');
        $this->assertFalse($flags['can_cancel'], 'Converted quotation can_cancel must be false');
        $this->assertFalse($flags['can_edit_creation_date'], 'Converted quotation can_edit_creation_date must be false');
        $this->assertTrue($flags['can_delete'], 'Converted quotation can_delete must be true');
        $this->assertFalse($flags['can_edit'], 'Converted quotation can_edit must be false');

        $docData = $resShow->json('document');
        $this->assertEquals($invoice->id, $docData['converted_document_id']);
        $this->assertEquals($invoice->id, $docData['converted_document']['id']);
        $this->assertEquals($invoice->number, $docData['converted_document']['number']);
        $this->assertEquals('tax_invoice', $docData['converted_document']['type']);
        $this->assertFalse($docData['converted_document']['is_deleted']);

        // 2. Try to cancel converted quotation -> 422
        $resCancel = $this->postJson("/api/admin/billing/client-directory/{$this->client->id}/documents/quotation/{$quotation->id}/cancel", [
            'cancellation_reason' => 'Trying to cancel converted',
        ]);
        $resCancel->assertStatus(422);
        $resCancel->assertJson(['message' => 'Converted quotations cannot be cancelled.']);

        // 3. Try to edit creation date on converted quotation -> 422
        $resDate = $this->patchJson("/api/admin/billing/client-directory/{$this->client->id}/documents/quotation/{$quotation->id}/creation-date", [
            'new_creation_date' => '2026-05-11',
        ]);
        $resDate->assertStatus(422);
        $resDate->assertJson(['message' => 'Converted quotations cannot have their creation date edited.']);

        // 4. Delete converted quotation -> 200 (allowed)
        $resDelete = $this->deleteJson("/api/admin/billing/client-directory/{$this->client->id}/documents/quotation/{$quotation->id}");
        $resDelete->assertStatus(200);
        $this->assertSoftDeleted('commercial_documents', ['id' => $quotation->id]);
    }

    public function test_soft_deleted_converted_invoice_still_shows_converted_document_is_deleted_true(): void
    {
        $invoice = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $this->customer->id,
            'type' => 'tax_invoice',
            'number' => 'INV-DEL-01',
            'document_date' => '2026-05-15',
            'status' => 'issued',
            'taxable_amount' => 1000,
            'grand_total' => 1180,
        ]);

        $quotation = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $this->customer->id,
            'type' => 'quotation',
            'number' => 'QT-DEL-01',
            'document_date' => '2026-05-10',
            'status' => 'cancelled',
            'taxable_amount' => 1000,
            'grand_total' => 1180,
            'converted_document_id' => $invoice->id,
        ]);

        // Soft delete the invoice
        $invoice->delete();
        $this->assertTrue($invoice->trashed());

        // Check list response
        $resList = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/quotation");
        $resList->assertStatus(200);
        $listDoc = collect($resList->json('documents.data'))->firstWhere('id', $quotation->id);
        $this->assertNotNull($listDoc);
        $this->assertEquals($invoice->id, $listDoc['converted_document_id']);
        $this->assertNotNull($listDoc['converted_document']);
        $this->assertTrue($listDoc['converted_document']['is_deleted']);
        $this->assertEquals('INV-DEL-01', $listDoc['converted_document']['number']);

        // Check show response
        $resShow = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/quotation/{$quotation->id}");
        $resShow->assertStatus(200);
        $showConverted = $resShow->json('document.converted_document');
        $this->assertNotNull($showConverted);
        $this->assertEquals($invoice->id, $showConverted['id']);
        $this->assertEquals('INV-DEL-01', $showConverted['number']);
        $this->assertTrue($showConverted['is_deleted']);
    }

    public function test_admin_pdf_endpoint_returns_200_application_pdf_for_quotation_and_delivery_challan(): void
    {
        Storage::fake('public');

        // 1. Quotation PDF
        $quotation = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $this->customer->id,
            'type' => 'quotation',
            'number' => 'QT-PDF-01',
            'document_date' => '2026-05-10',
            'due_date' => '2026-05-25',
            'status' => 'issued',
            'taxable_amount' => 1000,
            'grand_total' => 1180,
            'terms' => 'Standard payment terms apply.',
        ]);

        DocumentLineItem::create([
            'commercial_document_id' => $quotation->id,
            'description' => 'Consulting Services',
            'hsn_sac' => '998311',
            'qty' => 1,
            'unit' => 'NOS',
            'rate' => 1000,
            'taxable_amount' => 1000,
            'gst_rate' => 18,
        ]);

        $resQuoPdf = $this->get("/api/admin/billing/client-directory/{$this->client->id}/documents/quotation/{$quotation->id}/pdf");
        $resQuoPdf->assertStatus(200);
        $resQuoPdf->assertHeader('content-type', 'application/pdf');

        // 2. Delivery Challan PDF
        $dc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $this->customer->id,
            'type' => 'delivery_challan',
            'number' => 'DC-PDF-01',
            'document_date' => '2026-05-10',
            'status' => 'issued',
            'taxable_amount' => 1000,
            'grand_total' => 1180,
            'reason_for_transportation' => 'job_work',
            'vehicle_no' => 'MH-04-1234',
            'transporter_name' => 'Express Cargo',
            'eway_bill_no' => 'EWB-123456789012',
            'receiver_name' => 'Warehouse Supervisor',
        ]);

        DocumentLineItem::create([
            'commercial_document_id' => $dc->id,
            'description' => 'Raw Materials',
            'hsn_sac' => '847130',
            'qty' => 5,
            'unit' => 'NOS',
            'rate' => 200,
            'taxable_amount' => 1000,
            'gst_rate' => 18,
        ]);

        $resDcPdf = $this->get("/api/admin/billing/client-directory/{$this->client->id}/documents/delivery_challan/{$dc->id}/pdf");
        $resDcPdf->assertStatus(200);
        $resDcPdf->assertHeader('content-type', 'application/pdf');
    }

    public function test_new_client_quotation_prefix_fallback_is_qt(): void
    {
        $newClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'Brand New Client Ltd',
            'has_gst' => true,
        ]);

        $invoiceService = app(InvoiceService::class);
        $prefix = $invoiceService->prefixFor($newClient, 'quotation');
        $this->assertEquals('QT', $prefix);
    }
}
