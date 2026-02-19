import { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse';
import { shopRepository } from './shops.repository';
import { regionRepository } from '../regions/regions.repository';

export async function shopsBulkRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // Download Template
    app.get('/import-template', async (request, reply) => {
        const headers = 'Name (Required),Region Name (Optional),Latitude (Required),Longitude (Required),Address (Optional),Contact Name (Optional),Contact Phone (Optional),Contact Email (Optional),Operating Hours (Optional),Notes (Optional),Geofence Radius (Optional)';
        const sample = '"Al-Madina Mart","Downtown Dubai",25.1972,55.2744,"Burj Park, Plot 23","Ali Ahmed","+971 50 123 4567","ali@example.com","9AM - 10PM","Key account",150';
        const csv = `${headers}\n${sample}`;
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename=shops_import_template.csv');
        return csv;
    });

    // Bulk Import
    app.post('/import', async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });
        
        if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' });

        const parts = request.parts();
        const results = { imported: 0, skipped: 0, errors: [] as string[] };
        
        // Caches to avoid duplicates and frequent DB hits
        const regionsMap = new Map<string, string>(); // Name (lower) -> ID
        const existingShops = new Set<string>(); // Name (lower) -> Exists?

        // Populate Caches
        const allRegions = await regionRepository.findAll(context.company.id);
        allRegions.forEach(r => regionsMap.set(r.name.toLowerCase(), r.id));

        // Note: For very large datasets, fetching all shops might be memory intensive. 
        // For 10k shops, it is fine (approx 1-2MB).
        const { shops: allShops } = await shopRepository.findAll({ companyId: context.company.id }); 
        allShops.forEach(s => existingShops.add(s.name.toLowerCase()));

        for await (const part of parts) {
            if (part.type === 'file') {
                const parser = part.file.pipe(parse({ 
                    columns: true, 
                    trim: true, 
                    skip_empty_lines: true,
                    bom: true 
                }));

                let rowCount = 0;
                for await (const row of parser) {
                    rowCount++;
                    try {
                        const name = row['Name (Required)'];
                        if (!name) throw new Error('Name is required');
                        
                        // Check duplicate
                        if (existingShops.has(name.toLowerCase())) {
                            throw new Error(`Shop "${name}" already exists`);
                        }

                        // Region
                        let regionId = undefined;
                        const regionName = row['Region Name (Optional)'];
                        if (regionName) {
                             const lowerRegion = regionName.trim().toLowerCase();
                             if (regionsMap.has(lowerRegion)) {
                                 regionId = regionsMap.get(lowerRegion);
                             } else {
                                 const newRegion = await regionRepository.create({ 
                                    companyId: context.company.id, 
                                    name: regionName.trim(),
                                    color: '#f4a261' // Default color
                                 });
                                 regionId = newRegion.id;
                                 regionsMap.set(lowerRegion, regionId);
                             }
                        }

                        // Create Shop
                        await shopRepository.create({
                            companyId: context.company.id,
                            name: name,
                            latitude: row['Latitude (Required)'] ? parseFloat(row['Latitude (Required)']) : undefined,
                            longitude: row['Longitude (Required)'] ? parseFloat(row['Longitude (Required)']) : undefined,
                            address: row['Address (Optional)'] || undefined,
                            contactName: row['Contact Name (Optional)'] || undefined,
                            contactPhone: row['Contact Phone (Optional)'] || undefined,
                            contactEmail: row['Contact Email (Optional)'] || undefined,
                            operatingHours: row['Operating Hours (Optional)'] || undefined,
                            notes: row['Notes (Optional)'] || undefined,
                            geofenceRadiusM: row['Geofence Radius (Optional)'] ? parseInt(row['Geofence Radius (Optional)']) : 100,
                            regionId: regionId
                        });

                        existingShops.add(name.toLowerCase()); // Add to cache to prevent dups within same file
                        results.imported++;
                        
                    } catch (e: any) {
                        results.skipped++;
                        results.errors.push(`Row ${rowCount}: ${e.message}`);
                    }
                }
            }
        }

        return results;
    });
}
