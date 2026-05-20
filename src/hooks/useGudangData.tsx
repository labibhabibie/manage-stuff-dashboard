// MOCKING API UNTUK NGAMBIL DATA DARI GUDANG
// NGAMBIL DATA YANG MEMILIKI AWB YANG SAMA (MAWB/HAWB)
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type GudangData = {
    id: string
    aju: string,
    kode_kantor: string,
    blawb: string,
    tanggal_awb: string | null
    airline_code: string | null
    ori_dest: string | null
    weight: string | null
    shipper_pic_name: string | null
    shipper_pic_number: string | null
}

const EMPTY_GUDANG: GudangData = {
    id: '',
    aju: 'FHAN26044069',
    kode_kantor: 'BGD',
    blawb: '',
    tanggal_awb: '2026-4-24',
    airline_code: 'GA',
    ori_dest: 'LAX-CGK',
    weight: '5',
    shipper_pic_name: 'Naufal',
    shipper_pic_number: '+6262626262'
}

// Module-level cache so data is fetched only once per app session,
// not once per component mount
let cachedRows: GudangData[] = []
let cachePromise: Promise<GudangData[]> | null = null

async function fetchGudangRows(): Promise<GudangData[]> {
    if (cachedRows.length > 0) return cachedRows
    if (cachePromise) return cachePromise

    cachePromise = (async () => {
        const { data, error } = await supabase
            .from('data_from_gudang')
            .select('id, aju, tanggal_awb, kode_kantor, blawb, airline_code, ori_dest, weight, shipper_pic_name, shipper_pic_number')
            .order('tanggal_awb', { ascending: true });

        if (error || !data) {
            console.warn('useGudangData: failed to fetch', error);
            cachedRows = []
            return []
        }

        cachedRows = data as GudangData[]
        return cachedRows
    })()

    return cachePromise
}

// ─── Hook: get all rows ───────────────────────────────────────────────────────
export function useGudangData() {
    const [rows, setRows] = useState<GudangData[]>(cachedRows)
    const [loading, setLoading] = useState(cachedRows.length === 0)

    useEffect(() => {
        if (cachedRows.length > 0) {
            setRows(cachedRows)
            setLoading(false)
            return
        }

        fetchGudangRows().then(data => {
            setRows(data)
            setLoading(false)
        })
    }, [])

    /**
     * Find a row whose blawb matches the given param (case-insensitive trim).
     * Falls back to the first row with blawb === '' if no match found.
     * Falls back to EMPTY_GUDANG if neither exists.
     */
    const getByBlawb = (blawb: string): GudangData => {
        if (rows.length === 0) return EMPTY_GUDANG

        const normalised = blawb.trim().toLowerCase()

        const matched = rows.find(r => (r.blawb ?? '').trim().toLowerCase() === normalised)
        if (matched) return matched

        const emptyBlawb = rows.find(r => (r.blawb ?? '').trim() === '')
        if (emptyBlawb) return emptyBlawb

        return EMPTY_GUDANG
    }

    return { rows, loading, getByBlawb, EMPTY_GUDANG }
}

export function useGudangForItem(blawb: string | undefined) {
    const { rows, loading: gudangLoading, getByBlawb, EMPTY_GUDANG } = useGudangData()
    const [gudang, setGudang] = useState<GudangData>(EMPTY_GUDANG)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (gudangLoading) return

        if (!blawb || rows.length === 0) {
            setGudang(EMPTY_GUDANG)
            setLoading(false)
            return
        }

        setGudang(getByBlawb(blawb))
        setLoading(false)
    }, [blawb, rows, gudangLoading])

    return { gudang, loading }
}