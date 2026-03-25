#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { ApolloClient } from './apollo-client.js';
import dotenv from 'dotenv';
import { parseArgs } from 'node:util';

// Load environment variables
dotenv.config();

// Parse command line arguments
const { values } = parseArgs({
  options: {
    'api-key': { type: 'string' }
  }
});

// Initialize Apollo.io client
const apiKey = values['api-key'] || process.env.APOLLO_IO_API_KEY;
if (!apiKey) {
  throw new Error('APOLLO_IO_API_KEY environment variable is required');
}

class ApolloServer {
  // Core server properties
  private server: Server;
  private apollo: ApolloClient;

  constructor() {
    this.server = new Server(
      {
        name: 'apollo-io-manager',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.apollo = new ApolloClient(apiKey);

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Define available tools
      const tools: Tool[] = [
        {
          name: 'people_enrichment',
          description: 'Use the People Enrichment endpoint to enrich data for 1 person',
          inputSchema: {
            type: 'object',
            properties: {
              first_name: { 
                type: 'string', 
                description: "Person's first name" 
              },
              last_name: { 
                type: 'string', 
                description: "Person's last name" 
              },
              email: { 
                type: 'string', 
                description: "Person's email address" 
              },
              domain: { 
                type: 'string', 
                description: "Company domain" 
              },
              organization_name: { 
                type: 'string', 
                description: "Organization name" 
              },
              linkedin_url: {
                type: 'string',
                description: "Person's LinkedIn profile URL"
              }
            }
          }
        },
        {
          name: 'organization_enrichment',
          description: 'Use the Organization Enrichment endpoint to enrich data for 1 company',
          inputSchema: {
            type: 'object',
            properties: {
              domain: { 
                type: 'string', 
                description: 'Company domain' 
              },
              name: { 
                type: 'string', 
                description: 'Company name' 
              }
            }
          }
        },
        {
          name: 'people_search',
          description: 'Search for people using Apollo.io. Free endpoint (no credits consumed). Supports filtering by org, title, location, email status, keywords, and more.',
          inputSchema: {
            type: 'object',
            properties: {
              q_organization_domains_list: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of organization domains to search within'
              },
              person_titles: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of job titles to search for'
              },
              person_seniorities: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of seniority levels to search for'
              },
              organization_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of Apollo organization IDs to filter by'
              },
              organization_locations: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of organization locations to filter by'
              },
              contact_email_status: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by email status (e.g. verified, guessed, unavailable)'
              },
              q_keywords: {
                type: 'string',
                description: 'Keywords to search for across person profiles'
              },
              person_locations: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of person locations to filter by'
              },
              include_similar_titles: {
                type: 'boolean',
                description: 'Include people with similar job titles'
              },
              organization_num_employees_ranges: {
                type: 'array',
                items: { type: 'string' },
                description: 'Employee count ranges (e.g. ["1,10", "11,50", "51,200"])'
              },
              page: {
                type: 'number',
                description: 'Page number (default 1, max 500)'
              },
              per_page: {
                type: 'number',
                description: 'Results per page (default 25, max 100)'
              }
            }
          }
        },
        {
          name: 'organization_search',
          description: 'Search for organizations using Apollo.io with full filtering (keyword tags, location, employee count, technology, revenue, job titles).',
          inputSchema: {
            type: 'object',
            properties: {
              q_organization_domains_list: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of organization domains to search for'
              },
              q_organization_keyword_tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Keyword tags to filter organizations by (e.g. industry terms)'
              },
              organization_locations: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of organization locations to search for'
              },
              organization_num_employees_ranges: {
                type: 'array',
                items: { type: 'string' },
                description: 'Employee count ranges (e.g. ["1,10", "11,50", "51,200"])'
              },
              currently_using_any_of_technology_uids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Apollo technology UIDs to filter by current tech stack'
              },
              revenue_range: {
                type: 'object',
                properties: {
                  min: { type: 'number', description: 'Minimum revenue' },
                  max: { type: 'number', description: 'Maximum revenue' }
                },
                description: 'Revenue range filter with min/max values'
              },
              q_organization_job_titles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter orgs by job titles they are hiring for'
              },
              page: {
                type: 'number',
                description: 'Page number (default 1, max 500)'
              },
              per_page: {
                type: 'number',
                description: 'Results per page (default 25, max 100)'
              }
            }
          }
        },
        {
          name: 'organization_job_postings',
          description: 'Use the Organization Job Postings endpoint to find job postings for a specific organization',
          inputSchema: {
            type: 'object',
            properties: {
              organization_id: { 
                type: 'string', 
                description: 'Apollo.io organization ID' 
              }
            },
            required: ['organization_id']
          }
        },
        {
          name: 'get_person_email',
          description: 'Get email address for a person using their Apollo ID',
          inputSchema: {
            type: 'object',
            properties: {
              apollo_id: {
                type: 'string',
                description: 'Apollo.io person ID'
              }
            },
            required: ['apollo_id']
          }
        },
        {
          name: 'employees_of_company',
          description: 'Find employees of a company using company name or website/LinkedIn URL',
          inputSchema: {
            type: 'object',
            properties: {
              company: {
                type: 'string',
                description: 'Company name'
              },
              website_url: {
                type: 'string',
                description: 'Company website URL'
              },
              linkedin_url: {
                type: 'string',
                description: 'Company LinkedIn URL'
              }
            },
            required: ['company']
          }
        },
        {
          name: 'bulk_people_enrichment',
          description: 'Bulk enrich data for up to 10 people at once. Consumes credits. Rate-limited at 50% of single-endpoint rate.',
          inputSchema: {
            type: 'object',
            properties: {
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    first_name: { type: 'string', description: "Person's first name" },
                    last_name: { type: 'string', description: "Person's last name" },
                    email: { type: 'string', description: "Person's email address" },
                    domain: { type: 'string', description: 'Company domain' },
                    linkedin_url: { type: 'string', description: "Person's LinkedIn URL" },
                    organization_name: { type: 'string', description: 'Organization name' },
                    id: { type: 'string', description: 'Apollo person ID' }
                  }
                },
                description: 'Array of up to 10 person objects to enrich',
                maxItems: 10
              },
              reveal_personal_emails: {
                type: 'boolean',
                description: 'Whether to reveal personal email addresses'
              },
              run_waterfall_email: {
                type: 'boolean',
                description: 'Whether to run waterfall email enrichment'
              }
            },
            required: ['details']
          }
        },
        {
          name: 'bulk_organization_enrichment',
          description: 'Bulk enrich data for up to 10 organizations at once. Rate-limited at 50% of single-endpoint rate.',
          inputSchema: {
            type: 'object',
            properties: {
              organizations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    domain: { type: 'string', description: 'Company domain' },
                    organization_name: { type: 'string', description: 'Organization name' },
                    id: { type: 'string', description: 'Apollo organization ID' }
                  }
                },
                description: 'Array of up to 10 organization objects to enrich',
                maxItems: 10
              }
            },
            required: ['organizations']
          }
        },
        {
          name: 'news_articles_search',
          description: 'Search for recent news articles about target companies. Useful for prospecting context before outreach.',
          inputSchema: {
            type: 'object',
            properties: {
              q_organization_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Apollo organization IDs to find news for'
              },
              page: {
                type: 'number',
                description: 'Page number (default 1)'
              },
              per_page: {
                type: 'number',
                description: 'Results per page (default 25, max 100)'
              }
            }
          }
        }
      ];

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const args = request.params.arguments ?? {};

        switch (request.params.name) {
          case 'people_enrichment': {
            const result = await this.apollo.peopleEnrichment(args);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'organization_enrichment': {
            const result = await this.apollo.organizationEnrichment(args);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'people_search': {
            const result = await this.apollo.peopleSearch(args);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'organization_search': {
            const result = await this.apollo.organizationSearch(args);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'organization_job_postings': {
            const result = await this.apollo.organizationJobPostings(args.organization_id as string);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'get_person_email': {
            const result = await this.apollo.getPersonEmail(args.apollo_id as string);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'employees_of_company': {
            const result = await this.apollo.employeesOfCompany(args as any);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          case 'bulk_people_enrichment': {
            const result = await this.apollo.bulkPeopleEnrichment(args as any);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          case 'bulk_organization_enrichment': {
            const result = await this.apollo.bulkOrganizationEnrichment(args as any);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          case 'news_articles_search': {
            const result = await this.apollo.newsArticlesSearch(args as any);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        console.error(`Error executing tool ${request.params.name}:`, error);
        return {
          content: [{
            type: 'text',
            text: `Apollo.io API error: ${error.message}`
          }],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Apollo.io MCP server started');
  }
}

export async function serve(): Promise<void> {
  const server = new ApolloServer();
  await server.run();
}

const server = new ApolloServer();
server.run().catch(console.error);
