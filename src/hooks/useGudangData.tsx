// MOCKING API UNTUK NGAMBIL DATA DARI GUDANG
// NGAMBIL DATA YANG MEMILIKI AWB YANG SAMA (MAWB/HAWB)
// saat ini cuma ngambil data ke index berapa secara berurutan
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type GudangData = {
    id: string
    tanggal_awb: string | null
    airline_code: string | null
    ori_dest: string | null
    weight: string | null
    shipper_pic_name: string | null
    shipper_pic_number: string | null
}

const EMPTY_GUDANG: GudangData = {
    id: '',
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
            .select('id, tanggal_awb, airline_code, ori_dest, weight, shipper_pic_name, shipper_pic_number')
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

    const getByIndex = (index: number): GudangData => {
        if (rows.length === 0) {
            console.log('ini nih 0')
            return EMPTY_GUDANG
        }
        return rows[index % rows.length]
    }

    const getForItem = (itemIndex: number): GudangData => {
        return getByIndex(itemIndex)
    }

    return { rows, loading, getByIndex, getForItem, EMPTY_GUDANG }
}

// ─── Hook: get a single row for one specific inspeksi item ───────────────────
// Fetches the item's order position automatically from the DB
export function useGudangForItem(inspeksiId: string | undefined) {
    const { rows, loading: gudangLoading, EMPTY_GUDANG } = useGudangData()
    const [gudang, setGudang] = useState<GudangData>(EMPTY_GUDANG)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!inspeksiId || gudangLoading) return
        if (rows.length === 0) {
            setGudang(EMPTY_GUDANG)
            setLoading(false)
            return
        }

        // Get stable index: position of this item in created_at order
        supabase
            .from('inspeksi_barang_v2')
            .select('id')
            .order('created_at', { ascending: true })
            .then(({ data }) => {
                const index = (data || []).findIndex(r => r.id === inspeksiId)
                const safeIndex = index >= 0 ? index : 0
                setGudang(rows[safeIndex % rows.length])
                setLoading(false)
            })
    }, [inspeksiId, rows, gudangLoading])

    return { gudang, loading }
}