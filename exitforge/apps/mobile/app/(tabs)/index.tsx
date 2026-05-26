import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import type { Case } from '@exitforge/shared';

const CASE_SERVICE_URL = process.env['EXPO_PUBLIC_CASE_SERVICE_URL'] ?? 'https://api.exitforge.com';

export default function CasesScreen() {
  const { getToken } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${CASE_SERVICE_URL}/api/v1/cases`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (res.ok) {
          const json = await res.json() as { data: Case[] };
          setCases(json.data);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>My Cases</Text>

      {cases.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active cases yet.</Text>
          <Text style={styles.emptySubtext}>Complete your intake to get started.</Text>
        </View>
      ) : (
        cases.map((c) => (
          <View key={c.id} style={styles.card}>
            <Text style={styles.caseId}>Case #{c.id.slice(-8).toUpperCase()}</Text>
            <Text style={styles.status}>{c.status.replace(/_/g, ' ')}</Text>
            {c.probabilityScore !== null && (
              <Text style={styles.probability}>
                Exit probability: {(c.probabilityScore * 100).toFixed(0)}%
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030711' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030711' },
  heading: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', marginBottom: 20 },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  caseId: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  status: { fontSize: 16, fontWeight: '600', color: '#f1f5f9' },
  probability: { fontSize: 13, color: '#6366f1', marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#f1f5f9' },
  emptySubtext: { fontSize: 14, color: '#64748b', marginTop: 8 },
});
