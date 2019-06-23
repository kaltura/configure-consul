
const aws = require('aws-sdk');
const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

function reloadPods() {
    const k8sApi = kc.makeApiClient(k8s.AppsV1beta2Api);
    const lastModifiedTime = Date.now();
    var resource = {
        spec: { 
            template: {
                metadata: {
                    labels: {
                        'kaltura/consul-last-update': `${lastModifiedTime}`
                    }
                }
            }
        }
    };

    const httpOptions = {
        headers: {
            'Content-Type': 'application/merge-patch+json'
        }
    };
    
    k8sApi.patchNamespacedDeployment('coredns', 'kube-system', resource, undefined, undefined, httpOptions)
    .then(() => {
        console.log(`Updated coredns deployment, last modified [${lastModifiedTime}]`)
    })
    .catch(err => console.error(`Failed to update coredns deployment: `, (err.response ? err.response.body : err)));
}

function setConsoleDNS(ips) {
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    k8sApi.readNamespacedConfigMap('coredns', 'kube-system')
    .then(response => {
        var existingConfigMap = response.body;
        
        var configmap = new k8s.V1ConfigMap();
        configmap.apiVersion = 'v1';
        configmap.metadata = new k8s.V1ObjectMeta();
        configmap.metadata.name = 'coredns';
        configmap.metadata.namespace = 'kube-system';
        configmap.metadata.labels = {
          'eks.amazonaws.com/component': 'coredns',
          'k8s-app': 'kube-dns'
        }
        configmap.data = {
            Corefile: `.:53 {
    errors
    health
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        upstream
        fallthrough in-addr.arpa ip6.arpa
    }
    prometheus :9153
    proxy . /etc/resolv.conf
    cache 30
}
service.consul:53 {
    errors
    cache 30
    proxy . ${ips.join(' ')}
}`
        };

        if(existingConfigMap.data.Corefile != configmap.data.Corefile) {
            k8sApi.replaceNamespacedConfigMap('coredns', 'kube-system', configmap)
            .then(response => {
                console.log('Generated core-dns map replaced');
                reloadPods();
            })
            .catch(err => console.error('Failed to replace core-dns config-maps: ', (err.response ? err.response.body : err)));
        }
    })
    .catch(err => console.error('Failed to get core-dns config-map: ', (err.response ? err.response.body : err)));
}

var ec2 = new aws.EC2({ apiVersion: '2016-11-15', region: process.env.REGION });
var params = {
    Filters: [
        {
            Name: "tag:Type",
            Values: [
                "consul"
            ]
        }
    ]
};

ec2.describeInstances(params, (err, data) => {
    if (err) {
        return console.error(err);
    }

    var ips = data.Reservations.map(reservation => reservation.Instances.pop().PrivateIpAddress);
    if(ips.length) {
        ips.sort();
        setConsoleDNS(ips);
    }
});
