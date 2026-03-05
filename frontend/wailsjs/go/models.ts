export namespace broker {
	
	export class BrokerInfo {
	    nodeId: number;
	    host: string;
	    port: number;
	    isController: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BrokerInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nodeId = source["nodeId"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.isController = source["isController"];
	    }
	}
	export class ClusterInfo {
	    clusterId: string;
	    controllerId: number;
	    brokers: BrokerInfo[];
	
	    static createFrom(source: any = {}) {
	        return new ClusterInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.clusterId = source["clusterId"];
	        this.controllerId = source["controllerId"];
	        this.brokers = this.convertValues(source["brokers"], BrokerInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ClusterStats {
	    brokerCount: number;
	    topicCount: number;
	    totalPartitions: number;
	    underReplicatedPartitions: number;
	    offlinePartitions: number;
	
	    static createFrom(source: any = {}) {
	        return new ClusterStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.brokerCount = source["brokerCount"];
	        this.topicCount = source["topicCount"];
	        this.totalPartitions = source["totalPartitions"];
	        this.underReplicatedPartitions = source["underReplicatedPartitions"];
	        this.offlinePartitions = source["offlinePartitions"];
	    }
	}
	export class CreateTopicRequest {
	    name: string;
	    partitions: number;
	    replicationFactor: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateTopicRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.partitions = source["partitions"];
	        this.replicationFactor = source["replicationFactor"];
	    }
	}
	export class PartitionLag {
	    partition: number;
	    commitOffset: number;
	    logEndOffset: number;
	    lag: number;
	
	    static createFrom(source: any = {}) {
	        return new PartitionLag(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.partition = source["partition"];
	        this.commitOffset = source["commitOffset"];
	        this.logEndOffset = source["logEndOffset"];
	        this.lag = source["lag"];
	    }
	}
	export class GroupLag {
	    groupId: string;
	    topic: string;
	    totalLag: number;
	    partitions: PartitionLag[];
	
	    static createFrom(source: any = {}) {
	        return new GroupLag(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.groupId = source["groupId"];
	        this.topic = source["topic"];
	        this.totalLag = source["totalLag"];
	        this.partitions = this.convertValues(source["partitions"], PartitionLag);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GroupDetail {
	    groupId: string;
	    state: string;
	    topics: GroupLag[];
	
	    static createFrom(source: any = {}) {
	        return new GroupDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.groupId = source["groupId"];
	        this.state = source["state"];
	        this.topics = this.convertValues(source["topics"], GroupLag);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class GroupMemberInfo {
	    memberId: string;
	    clientId: string;
	    clientHost: string;
	    topics: string[];
	
	    static createFrom(source: any = {}) {
	        return new GroupMemberInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.memberId = source["memberId"];
	        this.clientId = source["clientId"];
	        this.clientHost = source["clientHost"];
	        this.topics = source["topics"];
	    }
	}
	export class GroupSummary {
	    groupId: string;
	    state: string;
	    totalLag: number;
	
	    static createFrom(source: any = {}) {
	        return new GroupSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.groupId = source["groupId"];
	        this.state = source["state"];
	        this.totalLag = source["totalLag"];
	    }
	}
	
	export class PartitionMetadata {
	    partition: number;
	    leader: number;
	    replicas: number[];
	    isr: number[];
	
	    static createFrom(source: any = {}) {
	        return new PartitionMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.partition = source["partition"];
	        this.leader = source["leader"];
	        this.replicas = source["replicas"];
	        this.isr = source["isr"];
	    }
	}
	export class ProduceHeader {
	    key: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new ProduceHeader(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	    }
	}
	export class ProduceRequest {
	    topic: string;
	    partition: number;
	    key: string;
	    value: string;
	    headers: ProduceHeader[];
	
	    static createFrom(source: any = {}) {
	        return new ProduceRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.topic = source["topic"];
	        this.partition = source["partition"];
	        this.key = source["key"];
	        this.value = source["value"];
	        this.headers = this.convertValues(source["headers"], ProduceHeader);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Topic {
	    name: string;
	    partitions: number;
	
	    static createFrom(source: any = {}) {
	        return new Topic(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.partitions = source["partitions"];
	    }
	}
	export class TopicConfigEntry {
	    name: string;
	    value: string;
	    isDefault: boolean;
	    readOnly: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TopicConfigEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	        this.isDefault = source["isDefault"];
	        this.readOnly = source["readOnly"];
	    }
	}
	export class TopicMetadata {
	    name: string;
	    partitions: PartitionMetadata[];
	
	    static createFrom(source: any = {}) {
	        return new TopicMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.partitions = this.convertValues(source["partitions"], PartitionMetadata);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace plugin {
	
	export class Plugin {
	    id: string;
	    name: string;
	    topicPattern: string;
	    script: string;
	
	    static createFrom(source: any = {}) {
	        return new Plugin(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.topicPattern = source["topicPattern"];
	        this.script = source["script"];
	    }
	}

}

export namespace profile {
	
	export class TopicGroup {
	    id: string;
	    name: string;
	    topics: string[];
	
	    static createFrom(source: any = {}) {
	        return new TopicGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.topics = source["topics"];
	    }
	}
	export class NamedCredential {
	    id: string;
	    name: string;
	    sasl: SASLConfig;
	
	    static createFrom(source: any = {}) {
	        return new NamedCredential(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.sasl = this.convertValues(source["sasl"], SASLConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SchemaRegistryConfig {
	    url: string;
	    username: string;
	
	    static createFrom(source: any = {}) {
	        return new SchemaRegistryConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.username = source["username"];
	    }
	}
	export class TLSConfig {
	    enabled: boolean;
	    insecureSkipVerify: boolean;
	    caCertPath: string;
	    clientCertPath: string;
	    clientKeyPath: string;
	
	    static createFrom(source: any = {}) {
	        return new TLSConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.insecureSkipVerify = source["insecureSkipVerify"];
	        this.caCertPath = source["caCertPath"];
	        this.clientCertPath = source["clientCertPath"];
	        this.clientKeyPath = source["clientKeyPath"];
	    }
	}
	export class SASLConfig {
	    mechanism: string;
	    username: string;
	    oauthTokenURL?: string;
	    oauthClientID?: string;
	    oauthScopes?: string[];
	
	    static createFrom(source: any = {}) {
	        return new SASLConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mechanism = source["mechanism"];
	        this.username = source["username"];
	        this.oauthTokenURL = source["oauthTokenURL"];
	        this.oauthClientID = source["oauthClientID"];
	        this.oauthScopes = source["oauthScopes"];
	    }
	}
	export class Broker {
	    id: string;
	    name: string;
	    addresses: string[];
	    sasl: SASLConfig;
	    tls: TLSConfig;
	    schemaRegistry: SchemaRegistryConfig;
	    credentials?: NamedCredential[];
	    activeCredentialID?: string;
	    topicGroups?: TopicGroup[];
	    pinnedTopics?: string[];
	
	    static createFrom(source: any = {}) {
	        return new Broker(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.addresses = source["addresses"];
	        this.sasl = this.convertValues(source["sasl"], SASLConfig);
	        this.tls = this.convertValues(source["tls"], TLSConfig);
	        this.schemaRegistry = this.convertValues(source["schemaRegistry"], SchemaRegistryConfig);
	        this.credentials = this.convertValues(source["credentials"], NamedCredential);
	        this.activeCredentialID = source["activeCredentialID"];
	        this.topicGroups = this.convertValues(source["topicGroups"], TopicGroup);
	        this.pinnedTopics = source["pinnedTopics"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Profile {
	    id: string;
	    name: string;
	    brokers: Broker[];
	
	    static createFrom(source: any = {}) {
	        return new Profile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.brokers = this.convertValues(source["brokers"], Broker);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	

}

export namespace search {
	
	export class SearchRequest {
	    topic: string;
	    keyPattern: string;
	    valuePattern: string;
	    partitions: number[];
	    timestampFrom?: number;
	    timestampTo?: number;
	    maxResults: number;
	    maxScan: number;
	    useRegex: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SearchRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.topic = source["topic"];
	        this.keyPattern = source["keyPattern"];
	        this.valuePattern = source["valuePattern"];
	        this.partitions = source["partitions"];
	        this.timestampFrom = source["timestampFrom"];
	        this.timestampTo = source["timestampTo"];
	        this.maxResults = source["maxResults"];
	        this.maxScan = source["maxScan"];
	        this.useRegex = source["useRegex"];
	    }
	}

}

export namespace updater {
	
	export class Release {
	    tag_name: string;
	    name: string;
	    html_url: string;
	    body: string;
	
	    static createFrom(source: any = {}) {
	        return new Release(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tag_name = source["tag_name"];
	        this.name = source["name"];
	        this.html_url = source["html_url"];
	        this.body = source["body"];
	    }
	}

}

