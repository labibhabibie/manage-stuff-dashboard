import { supabase } from './supabase'

const BASE_URL = 'https://apisdev-gw.beacukai.go.id/openapi/cnpibk'
const USE_MOCK = true // ← set to false when real API is ready

// ─── Types ────────────────────────────────────────────────────────────────────

export type XraySubmitPayload = {
    nomorAju: string
    nomorBlAwb: string
    tanggalBlAwb: string
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

export type XrayFotoDetail = {
    namaFile: string
    waktuRekam: string
}

export type XrayGetResponse = {
    success: boolean
    code: number
    message: string
    data: {
        nomorAju: string
        nomorBlAwb: string
        tanggalBlAwb: string
        kodeKantor: string
        npwpPemberitahu: string
        totalFotoTerupload: number
        keterangan: string | null
        detail: XrayFotoDetail[]
    } | null
    timestamp: string
}

// ─── Upload images to Supabase Storage ───────────────────────────────────────

async function uploadImagesToStorage(
    nomorBlawb: string,
    images: File[]
): Promise<{ url: string; name: string }[]> {
    const results: { url: string; name: string }[] = []

    for (const file of images) {
        const path = `mockingBeacukai/${nomorBlawb}/${file.name}` // ← no Date.now()
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

function mockTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

// ─── #1 Get Foto X-Ray ────────────────────────────────────────────────────────

export async function getFotoXray(params: {
    nomorAju?: string
    nomorBlAwb?: string
    tanggalBlAwb?: string
    kodeKantor?: string
}): Promise<XrayGetResponse> {
    if (!USE_MOCK) {
        const query = new URLSearchParams()
        if (params.nomorAju)     query.set('nomorAju',     params.nomorAju)
        if (params.nomorBlAwb)   query.set('nomorBlAwb',   params.nomorBlAwb)
        if (params.tanggalBlAwb) query.set('tanggalBlAwb', params.tanggalBlAwb)
        if (params.kodeKantor)   query.set('kodeKantor',   params.kodeKantor)

        const res = await fetch(`${BASE_URL}/get-foto-xray?${query.toString()}`, {
            method: 'GET',
            headers: { Authorization: `Bearer YOUR_TOKEN_HERE` },
        })
        return res.json()
    }

    // ── MOCK: read from beacukai_xray_submissions + beacukai_xray_images ────────

    let query = supabase
        .from('beacukai_xray_submissions')
        .select('*, beacukai_xray_images(nama_file, waktu_rekam)')

    if (params.nomorAju) {
        query = query.eq('nomor_aju', params.nomorAju)
    } else if (params.nomorBlAwb) {
        query = query.eq('nomor_blawb', params.nomorBlAwb)
    }

    const { data: submission, error } = await query.maybeSingle()

    if (error || !submission) {
        return {
            success: false,
            code: 404,
            message: 'Data Foto Xray tidak ditemukan atas request yang diminta',
            data: null,
            timestamp: mockTimestamp(),
        }
    }

    const detail: XrayFotoDetail[] = (submission.beacukai_xray_images || []).map(
        (img: { nama_file: string; waktu_rekam: string }) => ({
            namaFile: img.nama_file,
            waktuRekam: img.waktu_rekam,
        })
    )

    return {
        success: true,
        code: 200,
        message: 'Sukses Mengambil Data Foto X-Ray',
        data: {
            nomorAju: submission.nomor_aju,
            nomorBlAwb: submission.nomor_blawb,
            tanggalBlAwb: submission.tanggal_blawb,
            kodeKantor: submission.kode_kantor,
            npwpPemberitahu: submission.npwp_pemberitahu || '',
            totalFotoTerupload: submission.total_foto || 0,
            keterangan: null,
            detail,
        },
        timestamp: mockTimestamp(),
    }
}

// ─── #2 Kirim Foto X-Ray ──────────────────────────────────────────────────────

export async function kirimFotoXray(payload: XraySubmitPayload): Promise<XrayResponse> {
    if (!USE_MOCK) {
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

    const { data: existing } = await supabase
        .from('beacukai_xray_submissions')
        .select('id')
        .eq('nomor_blawb', payload.nomorBlAwb)
        .maybeSingle()

    if (existing) {
        return {
            success: false,
            code: 409,
            message: 'Data X-Ray sudah ada, silahkan gunakan API add untuk menambah foto',
            data: null,
            timestamp: mockTimestamp(),
        }
    }

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

    const npwp = '0000000000000000000000'

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
        return {
            success: false,
            code: 500,
            message: 'Gagal menyimpan data submission',
            data: null,
            timestamp: mockTimestamp(),
        }
    }

    const imageRows = uploaded.map(img => ({
        submission_id: submission.id,
        file_url: img.url,
        nama_file: img.name,
        waktu_rekam: new Date().toISOString(),
    }))

    await supabase.from('beacukai_xray_images').insert(imageRows)

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

// ─── #3 Add Foto X-Ray ────────────────────────────────────────────────────────

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

    const imageRows = uploaded.map(img => ({
        submission_id: existing.id,
        file_url: img.url,
        nama_file: img.name,
        waktu_rekam: new Date().toISOString(),
    }))

    await supabase.from('beacukai_xray_images').insert(imageRows)

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

// ─── Helper: check if submission exists ───────────────────────────────────────

export async function checkSubmissionExists(nomorBlAwb: string): Promise<boolean> {
    const { data } = await supabase
        .from('beacukai_xray_submissions')
        .select('id')
        .eq('nomor_blawb', nomorBlAwb)
        .maybeSingle()
    return !!data
}