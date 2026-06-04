import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const settings = await base44.entities.PlatformSettings.filter({ key: 'pricing' });
    
    const defaultPricing = {
      monthly_price: 5000,
      quarterly_price: 13500,
      annual_price: 48000,
      currency: 'MWK',
    };
    
    const pricing = settings.length > 0 ? settings[0].value : defaultPricing;
    
    return Response.json({ 
      pricing: {
        monthly_price: pricing.monthly_price || defaultPricing.monthly_price,
        quarterly_price: pricing.quarterly_price || defaultPricing.quarterly_price,
        annual_price: pricing.annual_price || defaultPricing.annual_price,
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});