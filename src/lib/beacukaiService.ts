import { supabase } from './supabase'

const BASE_URL = 'https://apisdev-gw.beacukai.go.id/openapi/cnpibk'
const USE_MOCK = true // ← set to false when real API is ready

// ─── Types ────────────────────────────────────────────────────────────────────

export type XraySubmitPayload = {
    nomorAju: string
    nomorBlAwb: string
    tanggalBlAwb: string  // yyyy-MM-dd
    kodeKantor: string
    images: File[]
}

export type XrayResponse = {
    success: boolean
    code: number
    message: string
    data: {
        nomorAju: string
        nomorBlAwb: string
        tanggalBlAwb: string
        kodeKantor: string
        npwpPemberitahu: string
        jumlahFotoTerupload: number
        keterangan: string
    } | null
    timestamp: string
}

// ─── Upload images to Supabase Storage and return public URLs ─────────────────

async function uploadImagesToStorage(
    nomorBlawb: string,
    images: File[]
): Promise<{ url: string; name: string }[]> {
    const results: { url: string; name: string }[] = []

    for (const file of images) {
        const path = `mockingBeacukai/${nomorBlawb}/${Date.now()}_${file.name}`
        const { data, error } = await supabase.storage
            .from('foto-xray')
            .upload(path, file, { upsert: true })

        if (error) {
            console.error('Upload error:', error)
            continue
        }

        const { data: { publicUrl } } = supabase.storage
            .from('foto-xray')
            .getPublicUrl(data.path)

        results.push({ url: publicUrl, name: file.name })
    }

    return results
}

// ─── Mock timestamp helper ────────────────────────────────────────────────────

function mockTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

// ─── #1 Kirim Foto X-Ray ──────────────────────────────────────────────────────

export async function kirimFotoXray(payload: XraySubmitPayload): Promise<XrayResponse> {
    if (!USE_MOCK) {
        // Real API call — swap in when token/auth is ready
        const formData = new FormData()
        formData.append('data', JSON.stringify({
            nomorAju: payload.nomorAju,
            nomorBlAwb: payload.nomorBlAwb,
            tanggalBlAwb: payload.tanggalBlAwb,
            kodeKantor: payload.kodeKantor,
        }))
        payload.images.forEach(img => formData.append('images', img))

        const res = await fetch(`${BASE_URL}/kirim-foto-xray`, {
            method: 'POST',
            headers: { Authorization: `Bearer YOUR_TOKEN_HERE` },
            body: formData,
        })
        return res.json()
    }

    // ── MOCK IMPLEMENTATION ──────────────────────────────────────────────────────

    // Check: does a submission already exist for this nomorBlawb?
    const { data: existing } = await supabase
        .from('beacukai_xray_submissions')
        .select('id')
        .eq('nomor_blawb', payload.nomorBlAwb)
        .maybeSingle()

    if (existing) {
        // Simulate 409 Conflict
        return {
            success: false,
            code: 409,
            message: 'Data X-Ray sudah ada, silahkan gunakan API add untuk menambah foto',
            data: null,
            timestamp: mockTimestamp(),
        }
    }

    // Upload images to storage
    const uploaded = await uploadImagesToStorage(payload.nomorBlAwb, payload.images)

    if (uploaded.length === 0) {
        return {
            success: false,
            code: 500,
            message: 'Gagal upload foto ke storage',
            data: null,
            timestamp: mockTimestamp(),
        }
    }

    // Mock NPWP
    const npwp = '0000000000000000000000'

    // Insert submission row
    const { data: submission, error: submissionError } = await supabase
        .from('beacukai_xray_submissions')
        .insert({
            nomor_aju: payload.nomorAju,
            nomor_blawb: payload.nomorBlAwb,
            tanggal_blawb: payload.tanggalBlAwb,
            kode_kantor: payload.kodeKantor,
            npwp_pemberitahu: npwp,
            total_foto: uploaded.length,
        })
        .select()
        .single()

    if (submissionError || !submission) {
        console.error('Submission insert error:', submissionError)
        return {
            success: false,
            code: 500,
            message: 'Gagal menyimpan data submission',
            data: null,
            timestamp: mockTimestamp(),
        }
    }

    // Insert image rows
    const imageRows = uploaded.map(img => ({
        submission_id: submission.id,
        file_url: img.url,
        nama_file: img.name,
        waktu_rekam: new Date().toISOString(),
    }))

    const { error: imageError } = await supabase
        .from('beacukai_xray_images')
        .insert(imageRows)

    if (imageError) {
        console.error('Image insert error:', imageError)
    }

    return {
        success: true,
        code: 200,
        message: 'Sukses Kirim Foto Xray',
        data: {
            nomorAju: payload.nomorAju,
            nomorBlAwb: payload.nomorBlAwb,
            tanggalBlAwb: payload.tanggalBlAwb,
            kodeKantor: payload.kodeKantor,
            npwpPemberitahu: npwp,
            jumlahFotoTerupload: uploaded.length,
            keterangan: 'Sukses Upload Foto',
        },
        timestamp: mockTimestamp(),
    }
}

// ─── #2 Add Foto X-Ray ────────────────────────────────────────────────────────

export async function addFotoXray(payload: XraySubmitPayload): Promise<XrayResponse> {
    if (!USE_MOCK) {
        const formData = new FormData()
        formData.append('data', JSON.stringify({
            nomorAju: payload.nomorAju,
            nomorBlAwb: payload.nomorBlAwb,
            tanggalBlAwb: payload.tanggalBlAwb,
            kodeKantor: payload.kodeKantor,
        }))
        payload.images.forEach(img => formData.append('images', img))

        const res = await fetch(`${BASE_URL}/add-foto-xray`, {
            method: 'POST',
            headers: { Authorization: `Bearer YOUR_TOKEN_HERE` },
            body: formData,
        })
        return res.json()
    }

    // ── MOCK IMPLEMENTATION ──────────────────────────────────────────────────────

    // Check: submission must already exist
    const { data: existing } = await supabase
        .from('beacukai_xray_submissions')
        .select('id, npwp_pemberitahu, total_foto')
        .eq('nomor_blawb', payload.nomorBlAwb)
        .maybeSingle()

    if (!existing) {
        return {
            success: false,
            code: 404,
            message: 'Data Foto Xray tidak ditemukan, lakukan kirim Inspeksi terlebih dahulu sebelum menambah foto',
            data: null,
            timestamp: mockTimestamp(),
        }
    }

    // Upload new images
    const uploaded = await uploadImagesToStorage(payload.nomorBlAwb, payload.images)

    if (uploaded.length === 0) {
        return {
            success: false,
            code: 500,
            message: 'Gagal upload foto ke storage',
            data: null,
            timestamp: mockTimestamp(),
        }
    }

    // Insert new image rows
    const imageRows = uploaded.map(img => ({
        submission_id: existing.id,
        file_url: img.url,
        nama_file: img.name,
        waktu_rekam: new Date().toISOString(),
    }))

    await supabase.from('beacukai_xray_images').insert(imageRows)

    // Update total_foto count
    await supabase
        .from('beacukai_xray_submissions')
        .update({
            total_foto: (existing.total_foto || 0) + uploaded.length,
            updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

    return {
        success: true,
        code: 200,
        message: 'Sukses Menambah Foto Xray',
        data: {
            nomorAju: payload.nomorAju,
            nomorBlAwb: payload.nomorBlAwb,
            tanggalBlAwb: payload.tanggalBlAwb,
            kodeKantor: payload.kodeKantor,
            npwpPemberitahu: existing.npwp_pemberitahu || '',
            jumlahFotoTerupload: uploaded.length,
            keterangan: 'Sukses Upload Foto',
        },
        timestamp: mockTimestamp(),
    }
}

// ─── Helper: check if submission exists for an nomorBlawb ──────────────────────

export async function checkSubmissionExists(nomorBlAwb: string): Promise<boolean> {
    const { data } = await supabase
        .from('beacukai_xray_submissions')
        .select('id')
        .eq('nomor_blawb', nomorBlAwb)
        .maybeSingle()
    return !!data
}