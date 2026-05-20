import { supabase } from '../lib/supabase'

type ClearAllInspectionDataParams = {
    setLoading?: (loading: boolean) => void
    onSuccess?: () => void
}

export const clearAllInspectionData = async ({
                                                 setLoading,
                                                 onSuccess,
                                             }: ClearAllInspectionDataParams = {}) => {
    const confirmed = window.confirm(
        'Apakah Anda yakin ingin menghapus SEMUA data inspeksi?\n\nTindakan ini tidak dapat dibatalkan.'
    )

    if (!confirmed) return

    try {
        setLoading?.(true)

        // 1. delete child images first
        const { error: imageError } = await supabase
            .from('beacukai_xray_images')
            .delete()
            .not('id', 'is', null)

        if (imageError) throw imageError

        // 2. delete submissions
        const { error: submissionError } = await supabase
            .from('beacukai_xray_submissions')
            .delete()
            .not('id', 'is', null)

        if (submissionError) throw submissionError

        // 3. delete barang inspeksi
        const { error: barangError } = await supabase
            .from('barang_v2')
            .delete()
            .not('id', 'is', null)

        if (barangError) throw barangError

        // 4. delete inspeksi
        const { error: inspeksiError } = await supabase
            .from('inspeksi_barang_v3')
            .delete()
            .not('id', 'is', null)

        if (inspeksiError) throw inspeksiError

        alert('Semua data berhasil dihapus.')

        onSuccess?.()
    } catch (err) {
        console.error('CLEAR DATA ERROR:', err)

        alert(
            err instanceof Error
                ? err.message
                : 'Terjadi kesalahan saat menghapus data.'
        )
    } finally {
        setLoading?.(false)
    }
}